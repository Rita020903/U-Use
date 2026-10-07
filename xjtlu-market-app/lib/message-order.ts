import type { BookingMessage } from "./types";
export function compareMessages(
  a: Pick<BookingMessage, "id" | "createdAt">,
  b: Pick<BookingMessage, "id" | "createdAt">,
) {
  return a.createdAt < b.createdAt
    ? -1
    : a.createdAt > b.createdAt
      ? 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0;
}
export function mergeMessages(
  current: BookingMessage[],
  next: BookingMessage[],
) {
  return [
    ...new Map([...current, ...next].map((m) => [m.id, m])).values(),
  ].sort(compareMessages);
}
