import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testRuntime } from "./test-runtime.mjs";
const t = await testRuntime();
try {
  const { database } = t.load("database"),
    { listMessages, sendMessage } = t.load("messages"),
    { mergeMessages } = t.load("message-order"),
    owner = {
      id: "owner",
      name: "Owner",
      verified: true,
      verificationMode: "email",
    },
    buyer = { ...owner, id: "buyer", name: "Buyer" },
    outsider = { ...owner, id: "outsider" };
  await database(async (tx) => {
    for (const id of ["chat", "history", "foreign"])
      await tx.put("bookings", id, {
        id,
        ownerId: owner.id,
        requesterId: buyer.id,
        productTitle: "QA",
      });
    for (let i = 0; i < 250; i++) {
      const id = "m" + String(i).padStart(3, "0");
      await tx.put("messages", id, {
        id,
        bookingId: "history",
        senderId: owner.id,
        text: id,
        createdAt: "2026-10-05T00:00:00.000Z",
      });
    }
    await tx.put("messages", "foreign", {
      id: "foreign",
      bookingId: "foreign",
      createdAt: "2026-10-05T00:00:00.000Z",
    });
  });
  const body = { bookingId: "chat", text: " Hello ", requestId: randomUUID() };
  const [one, two] = await Promise.all([
    sendMessage(body, buyer),
    sendMessage(body, buyer),
  ]);
  assert.equal(one.id, two.id);
  assert.equal(one.text, "Hello");
  assert.equal((await database((tx) => tx.list("notifications"))).length, 1);
  assert.equal((await listMessages("chat", owner)).items.length, 1);
  assert.equal(
    (await sendMessage(body, { ...buyer, name: "Renamed" })).senderName,
    "Buyer",
  );
  await assert.rejects(
    sendMessage({ ...body, text: "Changed" }, buyer),
    (e) => e.status === 409,
  );
  assert.notEqual(
    (await sendMessage(body, owner)).id,
    one.id,
    "keys are scoped by account",
  );
  await assert.rejects(sendMessage(body, outsider), (e) => e.status === 403);
  await assert.rejects(
    listMessages("chat", { ...buyer, verified: false }),
    (e) => e.status === 401,
  );
  for (const text of ["", " ", "x".repeat(1001)])
    await assert.rejects(sendMessage({ ...body, text }, buyer), /1 至 1000/);
  await assert.rejects(
    sendMessage({ ...body, requestId: "invalid" }, buyer),
    /提交标识/,
  );
  const latest = await listMessages("history", buyer);
  assert.equal(latest.items.length, 200);
  assert.equal(latest.oldest, "m050");
  assert.equal(latest.hasMore, true);
  const older = await listMessages("history", buyer, latest.oldest);
  assert.equal(older.items.length, 50);
  assert.equal(older.oldest, "m000");
  assert.equal(older.hasMore, false);
  const merged = mergeMessages(latest.items, older.items);
  assert.equal(merged.length, 250);
  assert.equal(merged[0].id, "m000");
  assert.equal(merged.at(-1).id, "m249");
  assert.equal(mergeMessages(merged, latest.items).length, 250);
  assert.equal(
    (await listMessages("history", buyer, "", 1)).items[0].id,
    "m249",
  );
  for (const limit of [0, 201, 1.5])
    await assert.rejects(listMessages("history", buyer, "", limit), /分页参数/);
  for (const cursor of ["foreign", "missing"])
    await assert.rejects(listMessages("history", buyer, cursor), /分页位置/);
  await assert.rejects(
    listMessages("history", outsider),
    (e) => e.status === 403,
  );
  const { notificationHistory } = t.load("notification-history"),
    { mergeNotifications } = t.load("notification-order");
  await database(async (tx) => {
    for (let i = 0; i < 45; i++) {
      const id = "notice" + String(i).padStart(3, "0");
      await tx.put("notifications", id, {
        id,
        personId: "history-person",
        title: id,
        read: false,
        createdAt: "2026-10-06T00:00:00.000Z",
      });
    }
  });
  let before = "",
    notices = [],
    page;
  do {
    page = await notificationHistory("history-person", before, 20);
    notices = mergeNotifications(notices, page.items);
    before = page.oldest;
    assert.equal(page.unread, 45);
  } while (page.hasMore);
  assert.equal(notices.length, 45);
  assert.equal(notices[0].id, "notice044");
  assert.equal(notices.at(-1).id, "notice000");
  assert.equal(
    mergeNotifications([{ ...notices[0], read: true }], [notices[0]])[0].read,
    true,
  );
  await assert.rejects(
    notificationHistory("outsider", "notice044"),
    /分页位置/,
  );
  for (const limit of [0, 101, 1.5])
    await assert.rejects(
      notificationHistory("history-person", "", limit),
      /分页参数/,
    );
  console.log(
    "PASS: message ownership, retry deduplication, single notification, account-scoped keys, stable 250-message pagination and merging",
  );
} finally {
  await t.cleanup();
}
