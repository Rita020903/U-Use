import { database } from "./database";
import { ApiError } from "./http";
import { Notification } from "./types";
import { compareMessages } from "./message-order";
export async function notificationHistory(
  personId: string,
  before = "",
  limit = 20,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ApiError("通知分页参数无效");
  return database(async (tx) => {
    const cursor = before
      ? await tx.get<Notification>("notifications", before)
      : undefined;
    if (before && (!cursor || cursor.personId !== personId))
      throw new ApiError("通知分页位置无效");
    const all = (await tx.list<Notification>("notifications")).filter(
      (n) => n.personId === personId,
    );
    const candidates = all
      .filter((n) => !cursor || compareMessages(n, cursor) < 0)
      .sort((a, b) => compareMessages(b, a));
    const items = candidates.slice(0, limit);
    return {
      items,
      hasMore: candidates.length > limit,
      oldest: items.at(-1)?.id || "",
      unread: all.filter((n) => !n.read).length,
    };
  });
}
