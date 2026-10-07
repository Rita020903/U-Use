import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
const codes = new Map(),
  sockets = new Set();
const smtp = net.createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.write("220 localhost UUse test SMTP\r\n");
  let buffer = "",
    dataMode = false,
    message = "",
    recipient = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (dataMode) {
        if (line !== ".") {
          message += line + "\n";
          continue;
        }
        dataMode = false;
        const body = message.split("\n\n").slice(1).join("\n\n"),
          decoded = /Content-Transfer-Encoding: base64/i.test(message)
            ? Buffer.from(body, "base64").toString()
            : body,
          code = decoded.match(/\b(\d{6})\b/)?.[1];
        if (code) codes.set(recipient, code);
        message = "";
        socket.write("250 accepted\r\n");
        continue;
      }
      if (/^(EHLO|HELO)/i.test(line))
        socket.write("250-localhost\r\n250 SIZE 5000000\r\n");
      else if (/^RCPT TO:/i.test(line)) {
        recipient = line.match(/<([^>]+)>/)?.[1].toLowerCase();
        socket.write("250 ok\r\n");
      } else if (/^DATA/i.test(line)) {
        dataMode = true;
        socket.write("354 send message\r\n");
      } else if (/^QUIT/i.test(line)) {
        socket.end("221 bye\r\n");
      } else socket.write("250 ok\r\n");
    }
  });
});
smtp.listen(0, "127.0.0.1");
await once(smtp, "listening");
const reservation = net.createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const password = randomUUID(),
  cron = randomUUID(),
  temporary = await mkdtemp(path.join(os.tmpdir(), "uuse-api-")),
  url = `http://127.0.0.1:${port}`;
const admin = {
  Authorization: `Basic ${Buffer.from("admin:" + password).toString("base64")}`,
  "Content-Type": "application/json",
};
let server,
  output = "";
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATA_DIRECTORY: temporary,
  SQLITE_PATH: path.join(temporary, "private", "uuse.sqlite"),
  DATABASE_URL: "",
  ALLOW_LOCAL_DATABASE: "true",
  SEED_DEMO: "false",
  MIGRATE_LEGACY: "false",
  ADMIN_PASSWORD: password,
  AUTH_SECRET: randomUUID(),
  AUTH_DELIVERY: "local",
  SMTP_URL: `smtp://127.0.0.1:${smtp.address().port}`,
  SMTP_FROM: "test@example.test",
  CRON_SECRET: cron,
};
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (s) => (output += s));
  server.stderr.on("data", (s) => (output += s));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      if ((await fetch(url + "/api/products")).status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Production server failed: " + output);
}
async function stop() {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
}
const post = (route, body, headers = {}, method = "POST") =>
  fetch(url + route, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
async function expect(response, status) {
  assert.equal(
    response.status,
    status,
    `${response.url}: ${await response.clone().text()}`,
  );
  return response;
}
const json = async (response, status = 200) =>
  (await expect(response, status)).json();
async function login(label, previous = {}) {
  const email = label + "@student.xjtlu.edu.cn",
    sent = await json(
      await post("/api/auth", { action: "send", email }, previous),
    );
  assert.equal(
    sent.localCode,
    undefined,
    "production never returns developer OTP",
  );
  const code = codes.get(email);
  assert(code, "code was actually delivered over SMTP");
  await expect(
    await post(
      "/api/auth",
      { action: "verify", email, code: "000000" },
      previous,
    ),
    401,
  );
  const r = await expect(
      await post(
        "/api/auth",
        { action: "verify", email, code, name: label },
        previous,
      ),
      200,
    ),
    person = await r.json();
  return {
    person,
    headers: { Cookie: r.headers.getSetCookie()[0].split(";")[0] },
  };
}
function mutate(kind, id, changes) {
  const db = new DatabaseSync(env.SQLITE_PATH);
  try {
    db.exec("PRAGMA busy_timeout=10000");
    const row = db
      .prepare("SELECT payload FROM uuse_records WHERE kind=? AND id=?")
      .get(kind, id);
    db.prepare("UPDATE uuse_records SET payload=? WHERE kind=? AND id=?").run(
      JSON.stringify({ ...JSON.parse(row.payload), ...changes }),
      kind,
      id,
    );
  } finally {
    db.close();
  }
}
try {
  await start();
  const missingPage = await fetch(url + "/missing-qa-page");
  await expect(missingPage, 404);
  assert((await missingPage.text()).includes("找不到这个页面"));
  await expect(await fetch(url + "/api/bookings"), 401);
  await expect(await fetch(url + "/admin"), 401);
  await expect(await fetch(url + "/api/products?admin=1"), 401);
  await expect(await fetch(url + "/api/reports"), 401);
  await expect(
    await fetch(url + "/api/presence?campus=TAICANG&lat=31.483&lng=121.156"),
    401,
  );
  const guest = await json(await fetch(url + "/api/session"));
  assert.equal(guest.timetable, null);
  assert.equal(guest.verified, false);
  await expect(await post("/api/products", {}), 401);
  const owner = await login("owner"),
    buyer = await login("buyer"),
    outsider = await login("outsider");
  assert.notEqual(owner.person.id, buyer.person.id);
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    until = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10),
    monday = new Date(today + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const table = {
    weekOne: monday.toISOString().slice(0, 10),
    termEnd: until,
    lessons: [],
  };
  await json(await post("/api/session", table, buyer.headers));
  await json(
    await post("/api/session", table, { ...buyer.headers, Origin: url }),
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/session", { headers: outsider.headers }),
      )
    ).timetable,
    undefined,
  );
  await expect(await post("/api/session", null, buyer.headers), 400);
  await expect(
    await post(
      "/api/session",
      {
        ...table,
        lessons: [
          {
            id: "unreviewed",
            title: "TEST",
            day: 1,
            start: "09:00",
            end: "10:00",
            weeks: "1-10",
            room: "",
            reviewed: false,
          },
        ],
      },
      buyer.headers,
    ),
    400,
  );
  const png = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#52a683" },
    })
      .withExif({ IFD0: { Artist: "Private QA metadata" } })
      .png()
      .toBuffer(),
    form = new FormData();
  form.set("photo", new Blob([png], { type: "image/png" }), "test.png");
  const photo = await json(
    await fetch(url + "/api/photos", {
      method: "POST",
      headers: owner.headers,
      body: form,
    }),
    201,
  );
  await expect(await fetch(url + photo.url), 404);
  const storedPhoto = await fetch(url + photo.url, { headers: admin });
  await expect(storedPhoto, 200);
  const photoMetadata = await sharp(
    Buffer.from(await storedPhoto.arrayBuffer()),
  ).metadata();
  assert.equal(photoMetadata.format, "webp");
  assert.equal(photoMetadata.exif, undefined);
  const listing = {
    title: "Production QA item",
    condition: "Test fixture",
    category: "学习考试",
    campus: "TAICANG",
    spot: "C 栋公共入口",
    locationId: "tc-c",
    accessMode: "buy",
    price: 12,
    availableFrom: today,
    availableTo: until,
    photos: [photo.url],
  };
  await expect(await post("/api/products", listing, buyer.headers), 400);
  await expect(
    await post(
      "/api/products",
      { ...listing, handoffCoordinates: null },
      owner.headers,
    ),
    400,
  );
  const listingRequest = {
    ...listing,
    ownerId: outsider.person.id,
    requestId: randomUUID(),
  };
  const item = await json(
    await post("/api/products", listingRequest, owner.headers),
    201,
  );
  assert.equal(item.ownerId, owner.person.id);
  assert.equal(
    (
      await json(
        await post("/api/products", listingRequest, owner.headers),
        201,
      )
    ).id,
    item.id,
  );
  await expect(
    await post(
      "/api/products",
      { ...listingRequest, title: "Changed retry" },
      owner.headers,
    ),
    409,
  );
  assert.equal(item.handoffCoordinates, undefined);
  assert.equal((await json(await fetch(url + "/api/products"))).length, 0);
  await expect(
    await post(
      "/api/products",
      { id: item.id, action: "withdraw" },
      buyer.headers,
      "PATCH",
    ),
    403,
  );
  await expect(
    await post(
      "/api/products",
      { id: item.id, status: "可用" },
      buyer.headers,
      "PATCH",
    ),
    403,
  );
  await json(
    await post(
      "/api/products",
      { id: item.id, status: "可用" },
      admin,
      "PATCH",
    ),
  );
  await expect(await fetch(url + photo.url), 200);
  await expect(await fetch(url + "/api/products?from=2026-02-30"), 400);
  assert.equal(
    (
      await json(
        await fetch(url + "/api/products?from=" + today + "&to=" + today),
      )
    )[0].id,
    item.id,
  );
  const needBody = {
    title: "Need production QA item",
    note: "QA request",
    campus: "TAICANG",
    accessMode: "buy",
    from: today,
    to: today,
    budget: 12,
    ownerId: outsider.person.id,
  };
  await expect(await post("/api/needs", needBody), 401);
  await expect(await fetch(url + "/api/needs?mine=1"), 401);
  const needRequest = { ...needBody, requestId: randomUUID() };
  const need = await json(
    await post("/api/needs", needRequest, buyer.headers),
    201,
  );
  assert.equal(
    (await json(await post("/api/needs", needRequest, buyer.headers), 201)).id,
    need.id,
  );
  await expect(
    await post(
      "/api/needs",
      { ...needRequest, title: "Changed retry" },
      buyer.headers,
    ),
    409,
  );
  await expect(await fetch(url + "/api/products?needId=" + need.id), 403);
  await expect(
    await fetch(url + "/api/products?mine=1&needId=" + need.id),
    401,
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/products?mine=1&needId=" + need.id, {
          headers: owner.headers,
        }),
      )
    )[0].id,
    item.id,
  );
  assert.deepEqual(
    await json(
      await fetch(url + "/api/products?mine=1&needId=" + need.id, {
        headers: outsider.headers,
      }),
    ),
    [],
  );
  await expect(
    await post(
      "/api/needs",
      { id: need.id, action: "offer", productId: item.id },
      outsider.headers,
      "PATCH",
    ),
    403,
  );
  await expect(
    await post(
      "/api/needs",
      { id: need.id, action: "offer", productId: item.id },
      owner.headers,
      "PATCH",
    ),
    200,
  );
  await expect(
    await post(
      "/api/needs",
      { id: need.id, action: "offer", productId: item.id },
      owner.headers,
      "PATCH",
    ),
    409,
  );
  const publicNeed = (
    await json(await fetch(url + "/api/needs?campus=TAICANG"))
  ).items[0];
  assert.equal(publicNeed.isMine, false);
  assert.equal(publicNeed.ownerId, undefined);
  assert.deepEqual(publicNeed.offers, []);
  const ownNeed = (
    await json(
      await fetch(url + "/api/needs?mine=1", { headers: buyer.headers }),
    )
  ).items[0];
  assert.equal(ownNeed.isMine, true);
  assert.equal(ownNeed.offers[0].productId, item.id);
  assert.deepEqual(
    (
      await json(
        await fetch(url + "/api/needs?campus=TAICANG", {
          headers: outsider.headers,
        }),
      )
    ).items[0].offers,
    [],
  );
  await expect(
    await post(
      "/api/needs",
      { id: need.id, action: "resolved" },
      owner.headers,
      "PATCH",
    ),
    403,
  );
  await expect(
    await post(
      "/api/needs",
      { id: need.id, action: "resolved" },
      buyer.headers,
      "PATCH",
    ),
    200,
  );
  assert.equal(
    (await json(await fetch(url + "/api/needs?campus=TAICANG"))).items.length,
    0,
  );
  const reportedNeed = await json(
    await post("/api/needs", needBody, buyer.headers),
    201,
  );
  await expect(
    await fetch(url + "/api/needs?reviewId=" + reportedNeed.id),
    403,
  );
  const review = await json(
    await fetch(url + "/api/needs?reviewId=" + reportedNeed.id, {
      headers: admin,
    }),
  );
  assert.equal(review.title, needBody.title);
  assert.equal(review.ownerId, undefined);
  await expect(
    await post(
      "/api/needs",
      { id: reportedNeed.id, action: "hide" },
      buyer.headers,
      "PATCH",
    ),
    403,
  );
  await expect(
    await post(
      "/api/needs",
      { id: reportedNeed.id, action: "hide" },
      admin,
      "PATCH",
    ),
    200,
  );
  assert.equal(
    (await json(await fetch(url + "/api/needs?campus=TAICANG"))).items.length,
    0,
  );
  const time = new Date(Date.now() + 10 * 60000).toISOString(),
    bookingInput = {
      requestId: randomUUID(),
      productId: item.id,
      campus: "TAICANG",
      spot: listing.spot,
      locationId: "tc-c",
      time,
      returnTime: time,
      expectedFee: 12,
      expectedDeposit: 0,
      expectedMode: "buy",
    };
  await expect(
    await post(
      "/api/bookings",
      { ...bookingInput, expectedFee: 1 },
      buyer.headers,
    ),
    409,
  );
  await expect(await post("/api/bookings", bookingInput, owner.headers), 409);
  const booking = await json(
    await post("/api/bookings", bookingInput, buyer.headers),
    201,
  );
  assert.equal(
    (await json(await post("/api/bookings", bookingInput, buyer.headers), 201))
      .id,
    booking.id,
  );
  await expect(
    await post(
      "/api/bookings",
      { ...bookingInput, note: "changed" },
      buyer.headers,
    ),
    409,
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/products?from=" + today + "&to=" + today),
      )
    ).length,
    0,
  );
  await expect(
    await post("/api/bookings", bookingInput, outsider.headers),
    409,
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/bookings", { headers: outsider.headers }),
      )
    ).length,
    0,
  );
  await expect(
    await post(
      "/api/bookings",
      { id: booking.id, status: "已完成" },
      buyer.headers,
      "PATCH",
    ),
    403,
  );
  await expect(
    await post(
      "/api/bookings",
      { id: booking.id, action: "accept" },
      buyer.headers,
      "PATCH",
    ),
    409,
  );
  await expect(
    await post(
      "/api/bookings",
      { id: booking.id, action: "cancel" },
      outsider.headers,
      "PATCH",
    ),
    403,
  );
  await expect(
    await post(
      "/api/bookings",
      { id: booking.id, status: "已确认" },
      admin,
      "PATCH",
    ),
    409,
  );
  await json(
    await post(
      "/api/bookings",
      { id: booking.id, action: "accept" },
      owner.headers,
      "PATCH",
    ),
  );
  const messageInput = {
    bookingId: booking.id,
    text: "Meet at the public entrance",
    requestId: randomUUID(),
  };
  const message = await json(
    await post("/api/messages", messageInput, buyer.headers),
    201,
  );
  assert.equal(
    (await json(await post("/api/messages", messageInput, buyer.headers), 201))
      .id,
    message.id,
  );
  await expect(
    await post(
      "/api/messages",
      { ...messageInput, text: "changed" },
      buyer.headers,
    ),
    409,
  );
  const staleAccount = { ...owner.headers, "X-UUse-Account": buyer.person.id };
  assert.equal(
    (
      await json(
        await fetch(url + "/api/messages?bookingId=" + booking.id, {
          headers: staleAccount,
        }),
        409,
      )
    ).code,
    "ACCOUNT_CHANGED",
  );
  await expect(
    await post(
      "/api/messages",
      { ...messageInput, requestId: randomUUID() },
      staleAccount,
    ),
    409,
  );
  await expect(
    await post("/api/session", { name: "Wrong account" }, staleAccount),
    409,
  );
  await expect(await post("/api/auth", {}, staleAccount, "DELETE"), 409);
  await expect(
    await fetch(url + "/api/messages?bookingId=" + booking.id + "&limit=0", {
      headers: owner.headers,
    }),
    400,
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/messages?bookingId=" + booking.id, {
          headers: owner.headers,
        }),
      )
    ).length,
    1,
  );
  await expect(
    await fetch(url + "/api/messages?bookingId=" + booking.id, {
      headers: outsider.headers,
    }),
    403,
  );
  await expect(
    await post(
      "/api/messages",
      { bookingId: booking.id, text: "intrusion" },
      outsider.headers,
    ),
    403,
  );
  const notices = await json(
    await fetch(url + "/api/notifications", { headers: owner.headers }),
  );
  assert(notices.length >= 1);
  const notificationPage = await expect(
    await fetch(url + "/api/notifications?limit=1", { headers: owner.headers }),
    200,
  );
  assert.equal((await notificationPage.json()).length, 1);
  assert(notificationPage.headers.get("X-Oldest-Notification"));
  await expect(
    await fetch(url + "/api/notifications?limit=0", { headers: owner.headers }),
    400,
  );
  await expect(
    await fetch(url + "/api/notifications?before=" + notices[0].id, {
      headers: outsider.headers,
    }),
    400,
  );
  const marked = await json(
    await post(
      "/api/notifications",
      { id: notices[0].id },
      owner.headers,
      "PATCH",
    ),
    200,
  );
  assert.deepEqual(marked.ids, [notices[0].id]);
  assert.equal(marked.unread, notices.filter((n) => !n.read && n.id !== notices[0].id).length);
  const afterRead = await json(
    await fetch(url + "/api/notifications", { headers: owner.headers }),
  );
  assert.equal(afterRead.find((n) => n.id === notices[0].id).read, true);
  for (const notice of notices.slice(1))
    assert.equal(afterRead.find((n) => n.id === notice.id).read, notice.read);
  await expect(
    await post(
      "/api/notifications",
      { id: notices[0].id },
      outsider.headers,
      "PATCH",
    ),
    404,
  );
  assert.equal(
    (
      await json(
        await post(
          "/api/bookings",
          { id: booking.id, action: "handoff" },
          owner.headers,
          "PATCH",
        ),
      )
    ).status,
    "已确认",
  );
  assert.equal(
    (
      await json(
        await post(
          "/api/bookings",
          { id: booking.id, action: "handoff" },
          buyer.headers,
          "PATCH",
        ),
      )
    ).status,
    "已完成",
  );
  assert.equal((await json(await fetch(url + "/api/products"))).length, 0);
  assert.equal(
    (await json(await post("/api/bookings", bookingInput, buyer.headers), 201))
      .status,
    "已完成",
  );
  const rental = await json(
    await post(
      "/api/products",
      {
        ...listing,
        title: "Rental QA",
        accessMode: "rent",
        rentPrice: 5,
        deposit: 20,
        returnRule: "return at entrance",
      },
      owner.headers,
    ),
    201,
  );
  await json(
    await post(
      "/api/products",
      { id: rental.id, status: "可用" },
      admin,
      "PATCH",
    ),
  );
  const rentStart = new Date(Date.now() + 2 * 86400000).toISOString(),
    rentEnd = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
    rentInput = {
      ...bookingInput,
      requestId: randomUUID(),
      productId: rental.id,
      time: rentStart,
      returnTime: rentEnd,
      expectedFee: 10,
      expectedDeposit: 20,
      expectedMode: "rent",
    };
  const pending = await json(
    await post("/api/bookings", rentInput, buyer.headers),
    201,
  );
  assert.equal(pending.rentalDays, 2);
  mutate("bookings", pending.id, { expiresAt: Date.now() - 1 });
  assert.equal(
    (
      await json(await fetch(url + "/api/bookings", { headers: buyer.headers }))
    ).find((b) => b.id === pending.id).status,
    "已取消",
  );
  assert.equal(
    (await json(await post("/api/bookings", rentInput, buyer.headers), 201))
      .status,
    "已取消",
  );
  const leaseA = randomUUID(),
    leaseB = randomUUID();
  await json(
    await post(
      "/api/presence",
      { campus: "TAICANG", lat: 31.48347, lng: 121.15568, leaseId: leaseA },
      buyer.headers,
    ),
  );
  await json(
    await post(
      "/api/presence",
      { campus: "TAICANG", lat: 31.48347, lng: 121.15568, leaseId: leaseB },
      buyer.headers,
    ),
  );
  const near = "/api/presence?campus=TAICANG&lat=31.483&lng=121.156";
  let people = await json(await fetch(url + near, { headers: owner.headers }));
  assert.equal(people.length, 1);
  assert.equal(people[0].lat, 31.484);
  assert(!("email" in people[0]));
  await expect(
    await fetch(url + "/api/presence?campus=TAICANG", {
      headers: owner.headers,
    }),
    400,
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/presence?campus=TAICANG&lat=32&lng=121.156", {
          headers: owner.headers,
        }),
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await json(
        await fetch(url + "/api/presence?campus=SIP&lat=31.276&lng=120.736", {
          headers: owner.headers,
        }),
      )
    ).length,
    0,
  );
  await json(
    await post("/api/presence", { leaseId: leaseA }, buyer.headers, "DELETE"),
  );
  assert.equal(
    (await json(await fetch(url + near, { headers: owner.headers }))).length,
    1,
    "another page lease remains",
  );
  mutate("presence", buyer.person.id + ":" + leaseB, {
    updatedAt: Date.now() - 121000,
  });
  assert.equal(
    (await json(await fetch(url + near, { headers: owner.headers }))).length,
    0,
  );
  await expect(
    await post(
      "/api/bookings",
      {},
      { ...buyer.headers, Origin: "https://evil.example" },
    ),
    403,
  );
  await expect(
    await post(
      "/api/session",
      { ...table, ignored: "x".repeat(1048577) },
      buyer.headers,
    ),
    413,
  );
  await expect(await fetch(url + "/api/products?sort=invalid"), 400);
  await expect(await post("/api/maintenance", {}), 403);
  await json(
    await post("/api/maintenance", {}, { Authorization: "Bearer " + cron }),
  );
  await stop();
  await start();
  assert(
    (
      await json(await fetch(url + "/api/bookings", { headers: buyer.headers }))
    ).some((b) => b.id === booking.id),
  );
  assert.equal(
    (await json(await fetch(url + "/api/session", { headers: buyer.headers })))
      .timetable.weekOne,
    table.weekOne,
  );
  const a = await login("switch-a"),
    b = await login("switch-b", a.headers);
  assert.notEqual(
    a.person.id,
    b.person.id,
    "a second email must never inherit a verified account ID",
  );
  await json(
    await fetch(url + "/api/auth", { method: "DELETE", headers: b.headers }),
  );
  assert.equal(
    (await json(await fetch(url + "/api/session", { headers: b.headers })))
      .verified,
    false,
  );
  console.log(
    "PASS: production SMTP login, disabled local bypass, ownership and private data isolation, photo validation, review, booking lifecycle, messaging, notifications, nearby privacy and leases, expiry, CSRF/body limits, maintenance, restart durability",
  );
} finally {
  await stop();
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => smtp.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
