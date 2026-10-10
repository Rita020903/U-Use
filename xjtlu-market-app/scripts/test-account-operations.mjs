import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { testRuntime } from "./test-runtime.mjs";
const t = await testRuntime();
try {
  const { database } = t.load("database"),
    { exportAccount, deleteAccount, clearTimetable, sendDeletionCode } =
      t.load("account"),
    { mailQueue, deliverNotifications, retryMail } = t.load("notifications"),
    { createOnce } = t.load("submissions"),
    { addProduct, editProduct, actOnBooking, getBookings } = t.load("data"),
    { needProducts, offerProduct, finishNeed } = t.load("needs"),
    person = {
      id: randomUUID(),
      email: "account@example.test",
      name: "Account",
      verified: true,
      verificationMode: "email",
      updatedAt: Date.now(),
    };
  process.env.AUTH_SECRET = randomUUID();
  await database(async (tx) => {
    await tx.put("people", person.id, {
      ...person,
      timetable: { weekOne: "2026-09-07", lessons: [] },
    });
    await tx.put("people", "other", {
      email: "private-other@example.test",
      timetable: { lessons: ["private"] },
    });
    await tx.put("emails", person.email, { id: person.id });
    await tx.put("sessions", "session-a", { personId: person.id });
    await tx.put("sessions", "session-b", { personId: person.id });
    await tx.put("bookings", "closed", {
      id: "closed",
      ownerId: "other",
      requesterId: person.id,
      requester: person.name,
      status: "已完成",
      closedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      note: "private note",
    });
    await tx.put("bookings", "active", {
      id: "active",
      ownerId: person.id,
      status: "有争议",
    });
    await tx.put("messages", "own", {
      id: "own",
      bookingId: "closed",
      senderId: person.id,
      text: "private text",
    });
    await tx.put("messages", "foreign", {
      id: "foreign",
      bookingId: "foreign",
      senderId: "other",
      text: "private foreign chat",
    });
    await tx.put("products", "own", {
      id: "own",
      ownerId: person.id,
      title: "Personal item",
      status: "可用",
      photos: ["/api/photos/own"],
    });
    await tx.put("photos", "own", { ownerId: person.id, data: "secret-photo" });
    await tx.put("needs", "own", { id: "own", ownerId: person.id });
    await tx.put("need-offers", "foreign-offer", {
      needId: "own",
      personId: "other",
    });
    await tx.put("outbox", "personal", {
      id: "personal",
      to: person.email,
      personId: person.id,
      attempts: 0,
      nextAttempt: 0,
    });
  });
  const exported = await exportAccount(person);
  await assert.rejects(
    editProduct("own", person.id, { photos: ["/api/photos/missing"] }),
    /照片已失效/,
  );
  await assert.rejects(
    addProduct({ ownerId: person.id, photos: ["/api/photos/missing"] }),
    /照片已失效/,
  );
  assert.deepEqual((await database((tx) => tx.get("products", "own"))).photos, [
    "/api/photos/own",
  ]);
  assert.equal(exported.account.email, person.email);
  assert.equal(exported.messages.length, 1);
  assert(!JSON.stringify(exported).includes("private-other@example.test"));
  assert(!JSON.stringify(exported).includes("secret-photo"));
  assert(!JSON.stringify(exported).includes("session-a"));
  await clearTimetable(person);
  assert.equal((await exportAccount(person)).account.timetable, undefined);
  const sent = await sendDeletionCode(person, true);
  await assert.rejects(sendDeletionCode(person, true), /60秒/);
  await assert.rejects(deleteAccount(person, "000000"), /不正确/);
  assert.equal(
    (await database((tx) => tx.get("account-deletion", person.id))).attempts,
    1,
  );
  await assert.rejects(deleteAccount(person, sent.localCode), /未结束/);
  assert(await database((tx) => tx.get("people", person.id)));
  await database((tx) => tx.remove("bookings", "active"));
  await deleteAccount(person, sent.localCode);
  assert.equal(await database((tx) => tx.get("people", person.id)), undefined);
  assert.equal((await database((tx) => tx.list("sessions"))).length, 0);
  assert.equal((await database((tx) => tx.list("photos"))).length, 0);
  assert.equal((await database((tx) => tx.list("outbox"))).length, 0);
  assert.equal((await database((tx) => tx.list("need-offers"))).length, 0);
  assert.equal(
    (await database((tx) => tx.get("bookings", "closed"))).requester,
    "已注销用户",
  );
  assert.equal(
    (await database((tx) => tx.get("messages", "own"))).text,
    "[该用户已注销，消息内容已移除]",
  );
  assert.equal(
    (await database((tx) => tx.get("products", "own"))).status,
    "已下架",
  );
  await assert.rejects(exportAccount(person), /失效/);
  await assert.rejects(
    editProduct("own", person.id, { title: "revived" }),
    /注销/,
  );
  await assert.rejects(
    actOnBooking("closed", person.id, "dispute", "stale private reason"),
    /注销/,
  );
  await assert.rejects(getBookings(person.id), /注销/);
  await assert.rejects(needProducts("own", person), /注销/);
  await assert.rejects(offerProduct("other-need", "own", person), /注销/);
  await assert.rejects(finishNeed("own", person, "withdrawn"), /注销/);
  assert.equal(
    (await database((tx) => tx.get("products", "own"))).title,
    "已注销用户的物品",
  );
  assert.equal(
    (await database((tx) => tx.get("bookings", "closed"))).status,
    "已完成",
  );
  await assert.rejects(
    database((tx) =>
      createOnce(tx, "needs", person.id, undefined, {}, async () => ({
        id: "stale-write",
      })),
    ),
    /注销/,
  );

  process.env.SMTP_URL = "invalid://localhost";
  process.env.SMTP_FROM = "test@example.test";
  await database((tx) =>
    tx.put("outbox", "failed", {
      id: "failed",
      to: "test@example.test",
      title: "test",
      attempts: 0,
      nextAttempt: 0,
    }),
  );
  for (let attempt = 1; attempt <= 5; attempt++) {
    await Promise.all([deliverNotifications(), deliverNotifications()]);
    const task = (await mailQueue())[0];
    assert.equal(
      task.attempts,
      attempt,
      "concurrent delivery claims only one lease",
    );
    assert.equal(task.leaseId, undefined);
    if (attempt < 5)
      await database((tx) =>
        tx.put("outbox", "failed", { ...task, nextAttempt: 0 }),
      );
  }
  assert((await mailQueue())[0].failedAt);
  await deliverNotifications();
  assert.equal((await mailQueue())[0].attempts, 5);
  await retryMail("failed");
  assert.equal((await mailQueue())[0].attempts, 0);
  await assert.rejects(retryMail("failed"), /等待投递/);
  assert(
    (await database((tx) => tx.list("audit"))).some(
      (x) => x.action === "retry-mail",
    ),
  );
  const backupDirectory = path.join(t.data, "backup-check");
  execFileSync(process.execPath, ["scripts/backup-database.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      SQLITE_PATH: path.join(t.data, "private/uuse.sqlite"),
      BACKUP_DIRECTORY: backupDirectory,
    },
    stdio: "pipe",
  });
  const restoredFile = path.join(
    backupDirectory,
    (await readdir(backupDirectory))[0],
  );
  assert.equal((await stat(restoredFile)).mode & 0o777, 0o600);
  const restored = new DatabaseSync(restoredFile);
  try {
    assert.equal(
      restored.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    const row = restored
      .prepare("SELECT payload FROM uuse_records WHERE kind=? AND id=?")
      .get("bookings", "closed");
    assert.equal(JSON.parse(row.payload).requester, "已注销用户");
    assert(
      restored
        .prepare("SELECT id FROM uuse_records WHERE kind=? AND id=?")
        .get("deleted-accounts", person.id),
    );
    assert.equal(
      restored
        .prepare("SELECT id FROM uuse_records WHERE kind=? AND id=?")
        .get("people", person.id),
      undefined,
    );
  } finally {
    restored.close();
  }
  console.log(
    "PASS: account export isolation, timetable clearing, dedicated deletion OTP, committed attempt limits, active dispute blocking, session/photo cleanup, preserved closed history, deleted-account booking/edit/needs rejected, atomic photo ownership checks, mail leases/backoff/failure/manual retry, private SQLite backup and restored data integrity",
  );
} finally {
  await t.cleanup();
}
