import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { testRuntime } from "./test-runtime.mjs";
const t = await testRuntime(),
  { database } = t.load("database"),
  {
    addBooking,
    getBookings,
    getProducts,
    actOnBooking,
    editProduct,
    refreshAvailability,
  } = t.load("data");
const now = Date.now(),
  originalNow = Date.now,
  start = new Date(now + 2 * 86400000).toISOString(),
  end = new Date(now + 2 * 86400000 + 25 * 3600000).toISOString();
const product = (id, extra = {}) => ({
  id,
  ownerId: "owner",
  title: id,
  campus: "TAICANG",
  spot: "C 栋公共入口",
  locationId: "tc-c",
  category: "学习考试",
  status: "可用",
  crossCampus: false,
  availableFrom: new Date(now - 86400000).toISOString().slice(0, 10),
  availableTo: new Date(now + 60 * 86400000).toISOString().slice(0, 10),
  accessMode: "rent",
  returnRequired: true,
  price: 0,
  rentPrice: 4.5,
  deposit: 20,
  ...extra,
});
const request = (id, extra = {}) => ({
  productId: id,
  requesterId: "buyer",
  campus: "TAICANG",
  locationId: "tc-c",
  spot: "C 栋公共入口",
  time: start,
  returnTime: end,
  note: "",
  requester: "forged",
  owner: "forged",
  depositSnapshot: 999,
  ...extra,
});
async function put(kind, id, value) {
  await database((tx) => tx.put(kind, id, value));
}
try {
  const { parseBookingTime } = t.load("booking-times");
  assert(Number.isFinite(parseBookingTime("2028-02-29T12:00:00+08:00")));
  for (const date of [
    "2027-02-29T12:00:00Z",
    "2026-02-30T12:00:00Z",
    "2026-10-05T24:00:00Z",
    "2026-10-05T12:00:00+14:01",
    "2026-10-05T12:00:00",
  ])
    assert(Number.isNaN(parseBookingTime(date)), date);
  for (const id of ["owner", "buyer", "other", "outsider"])
    await put("people", id, {
      id,
      name: id,
      verified: true,
      verificationMode: "email",
      updatedAt: now,
    });
  await assert.rejects(
    database(async (tx) => {
      await tx.put("meta", "rollback", { x: 1 });
      throw new Error("rollback");
    }),
    /rollback/,
  );
  assert.equal(await database((tx) => tx.get("meta", "rollback")), undefined);
  await put("products", "rental", product("rental"));
  const attempts = await Promise.allSettled([
    addBooking(request("rental")),
    addBooking(request("rental", { requesterId: "other" })),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  const b = attempts.find((r) => r.status === "fulfilled").value;
  assert.equal(b.feeSnapshot, 9);
  assert.equal(b.rentalDays, 2);
  assert.equal(b.depositSnapshot, 20);
  assert.equal(b.owner, "owner");
  assert.notEqual(b.requester, "forged");
  assert.equal((await getBookings("outsider")).length, 0);
  await assert.rejects(actOnBooking(b.id, "outsider", "cancel"), /无权/);
  await assert.rejects(actOnBooking(b.id, b.requesterId, "accept"), /当前状态/);
  await put("products", "second", product("second"));
  await assert.rejects(
    addBooking(request("second", { requesterId: "other" })),
    /其他交付/,
  );
  await assert.rejects(
    editProduct("rental", "owner", { title: "new" }),
    /进行中/,
  );
  await actOnBooking(b.id, "owner", "accept");
  await assert.rejects(actOnBooking(b.id, "owner", "handoff"), /尚未到达/);
  Date.now = () => Date.parse(b.time) - 600000;
  const first = await actOnBooking(b.id, "owner", "handoff");
  assert.equal(first.status, "已确认");
  await assert.rejects(actOnBooking(b.id, b.requesterId, "cancel"), /当前状态/);
  await assert.rejects(actOnBooking(b.id, "owner", "cancel"), /当前状态/);
  const handed = await actOnBooking(b.id, b.requesterId, "handoff");
  assert.equal(handed.status, "使用中");
  Date.now = () => Date.parse(b.returnTime) + 3600000;
  await assert.rejects(
    addBooking(
      request("rental", {
        time: new Date(Date.now() + 86400000).toISOString(),
        returnTime: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    ),
    /尚未归还/,
  );
  assert.equal(
    (await actOnBooking(b.id, b.requesterId, "return")).status,
    "待归还",
  );
  assert.equal((await actOnBooking(b.id, "owner", "return")).status, "已归还");
  Date.now = originalNow;
  await assert.rejects(
    addBooking(request("rental", { expectedFee: 1 })),
    /费用/,
  );
  const expiring = await addBooking(request("rental"));
  await put("bookings", expiring.id, { ...expiring, expiresAt: now - 1 });
  const replacement = await addBooking(request("rental"));
  assert.equal(
    (await getBookings("buyer")).find((x) => x.id === expiring.id).status,
    "已取消",
  );
  await actOnBooking(replacement.id, "buyer", "cancel");
  await put(
    "products",
    "sale",
    product("sale", {
      accessMode: "buy",
      returnRequired: false,
      price: 12,
      deposit: 0,
    }),
  );
  const sale = await addBooking(
    request("sale", { returnTime: start, offeredProductId: "second" }),
  );
  assert.equal(
    sale.offeredProductId,
    undefined,
    "non-swap requests cannot lock another item",
  );
  await actOnBooking(sale.id, "owner", "accept");
  Date.now = () => Date.parse(start) - 600000;
  await actOnBooking(sale.id, "owner", "handoff");
  assert.equal(
    (await actOnBooking(sale.id, "buyer", "handoff")).status,
    "已完成",
  );
  Date.now = originalNow;
  await assert.rejects(
    addBooking(request("sale", { returnTime: start })),
    /暂不可预约/,
  );
  await actOnBooking(sale.id, "buyer", "dispute", "收到物品后发现功能损坏");
  assert.equal(
    (await getProducts()).find((p) => p.id === "sale").status,
    "已下架",
  );
  await put(
    "products",
    "swap1",
    product("swap1", { accessMode: "swap", returnRequired: false, deposit: 0 }),
  );
  await put(
    "products",
    "swap2",
    product("swap2", {
      ownerId: "other",
      accessMode: "swap",
      returnRequired: false,
      deposit: 0,
    }),
  );
  const swapTime = new Date(now + 4 * 86400000).toISOString();
  await assert.rejects(
    addBooking(
      request("swap1", {
        time: swapTime,
        returnTime: swapTime,
        offeredProductId: "swap2",
      }),
    ),
    /自己/,
  );
  const swap = await addBooking(
    request("swap1", {
      requesterId: "other",
      time: swapTime,
      returnTime: swapTime,
      offeredProductId: "swap2",
    }),
  );
  await assert.rejects(
    addBooking(
      request("swap2", {
        time: new Date(now + 5 * 86400000).toISOString(),
        returnTime: new Date(now + 5 * 86400000).toISOString(),
        offeredProductId: "swap1",
      }),
    ),
    /已有预约/,
  );
  await actOnBooking(swap.id, "other", "cancel");
  const monday = new Date(start.slice(0, 10) + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const local = new Date(Date.parse(start) + 8 * 3600000),
    day = ((local.getUTCDay() + 6) % 7) + 1;
  await put("people", "buyer", {
    id: "buyer",
    verified: true,
    timetable: {
      weekOne: monday.toISOString().slice(0, 10),
      lessons: [
        {
          id: "class",
          title: "Another major",
          day,
          start: "00:00",
          end: "23:59",
          room: "TC-A-1001",
          weeks: "1-16",
          reviewed: true,
        },
      ],
    },
  });
  await put("people", "scheduler", { id: "scheduler", verified: true });
  await put("people", "student", {
    ...(await database((tx) => tx.get("people", "buyer"))),
    id: "student",
  });
  await put(
    "products",
    "scheduled",
    product("scheduled", { ownerId: "scheduler" }),
  );
  await assert.rejects(
    addBooking(request("scheduled", { requesterId: "student" })),
    /课表冲突/,
  );
  await put("people", "buyer", { id: "buyer", verified: true });
  const expired = product("old", { availableTo: "2020-01-01" });
  assert.equal(refreshAvailability(expired).availableTo, "2020-01-01");
  await put("products", "race", product("race"));
  const child = (who) =>
    new Promise((resolve, reject) => {
      const p = spawn(
        process.execPath,
        [
          "-e",
          `require(${JSON.stringify(path.join(t.runtime, "data.js"))}).addBooking(${JSON.stringify(request("race", { requesterId: who, time: new Date(now + 10 * 86400000).toISOString(), returnTime: new Date(now + 11 * 86400000).toISOString() }))}).then(()=>{console.log('success')}).catch(e=>{console.log('conflict');process.exitCode=0})`,
        ],
        { env: process.env },
      );
      let out = "";
      p.stdout.on("data", (s) => (out += s));
      p.on("error", reject);
      p.on("close", (code) =>
        code ? reject(new Error("child failed")) : resolve(out.trim()),
      );
    });
  const race = await Promise.all([child("buyer"), child("other")]);
  assert.deepEqual(race.sort(), ["conflict", "success"]);
  await t.load("database").closeDatabases();
  assert.equal(
    (await getBookings(undefined, true)).filter((b) => b.productId === "race")
      .length,
    1,
    "survives a reopened database",
  );
  Date.now = originalNow;
  for (const id of ["retry-owner", "retry-buyer"])
    await put("people", id, {
      id,
      name: id,
      verified: true,
      verificationMode: "email",
    });
  await put("products", "retry", product("retry", { ownerId: "retry-owner" }));
  const intent = request("retry", {
      requesterId: "retry-buyer",
      time: new Date(now + 15 * 86400000).toISOString(),
      returnTime: new Date(now + 16 * 86400000).toISOString(),
    }),
    key = randomUUID(),
    noticesBefore = (await database((tx) => tx.list("notifications"))).length;
  const [retryOne, retryTwo] = await Promise.all([
    addBooking(intent, key),
    addBooking(intent, key),
  ]);
  assert.equal(retryOne.id, retryTwo.id);
  assert.equal(
    (await database((tx) => tx.list("notifications"))).length,
    noticesBefore + 1,
  );
  assert.equal(
    (
      await addBooking(
        {
          ...intent,
          requester: "renamed",
          owner: "different",
          depositSnapshot: 123,
        },
        key,
      )
    ).id,
    retryOne.id,
  );
  await assert.rejects(
    addBooking({ ...intent, note: "changed" }, key),
    (e) => e.status === 409,
  );
  Date.now = () => now + 3 * 86400000;
  const replay = await addBooking(intent, key);
  assert.equal(replay.id, retryOne.id);
  assert.equal(
    replay.status,
    "已取消",
    "expired replay must not create a second booking",
  );
  assert.equal((await getBookings("retry-buyer")).length, 1);
  console.log(
    "PASS: rollback, multi-process locking, identity isolation, fee snapshots, swap locks, schedules, expiry, mutual handoff/return, overdue blocking, durable storage",
  );
} finally {
  Date.now = originalNow;
  await t.cleanup();
}
