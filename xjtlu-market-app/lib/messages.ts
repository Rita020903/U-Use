import { randomUUID } from "node:crypto";
import { database, Transaction } from "./database";
import { ApiError, text } from "./http";
import { Booking, BookingMessage, Person } from "./types";
import { createOnce } from "./submissions";
import { notify } from "./notifications";
import { compareMessages } from "./message-order";
async function participant(tx: Transaction, bookingId: string, person: Person) {
  if (
    !person.verified ||
    (process.env.NODE_ENV === "production" &&
      person.verificationMode !== "email")
  )
    throw new ApiError("请先用西浦邮箱登录", 401);
  const b = await tx.get<Booking>("bookings", bookingId);
  if (!b || ![b.ownerId, b.requesterId].includes(person.id))
    throw new ApiError("无权访问该交易消息", 403);
  return b;
}
export async function listMessages(
  bookingId: string,
  person: Person,
  before = "",
  limit = 200,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200)
    throw new ApiError("消息分页参数无效");
  return database(async (tx) => {
    await participant(tx, bookingId, person);
    const cursor = before
      ? await tx.get<BookingMessage>("messages", before)
      : undefined;
    if (before && (!cursor || cursor.bookingId !== bookingId))
      throw new ApiError("消息分页位置无效");
    const all = (await tx.list<BookingMessage>("messages"))
      .filter(
        (m) =>
          m.bookingId === bookingId &&
          (!cursor || compareMessages(m, cursor) < 0),
      )
      .sort(compareMessages);
    const items = all.slice(-limit);
    return { items, hasMore: all.length > limit, oldest: items[0]?.id || "" };
  });
}
export async function sendMessage(
  body: Record<string, unknown>,
  person: Person,
) {
  const bookingId = text(body.bookingId),
    message = text(body.text);
  if (!message || message.length > 1000)
    throw new ApiError("消息需为 1 至 1000 字");
  return database(async (tx) => {
    const b = await participant(tx, bookingId, person);
    return createOnce(
      tx,
      "messages",
      person.id,
      body.requestId,
      { bookingId, text: message },
      async () => {
        const item: BookingMessage = {
          id: randomUUID(),
          bookingId,
          senderId: person.id,
          senderName: person.name || "学生",
          text: message,
          createdAt: new Date().toISOString(),
        };
        await tx.put("messages", item.id, item);
        await notify(
          tx,
          (b.ownerId === person.id ? b.requesterId : b.ownerId)!,
          "「" + b.productTitle + "」收到新消息",
          bookingId,
        );
        return item;
      },
    );
  });
}
