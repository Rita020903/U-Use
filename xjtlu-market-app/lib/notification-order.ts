import type { Notification } from "./types";
import { compareMessages } from "./message-order";
export function mergeNotifications(
  current: Notification[],
  next: Notification[],
) {
  const rows = new Map(current.map((n) => [n.id, n]));
  for (const n of next)
    rows.set(n.id, { ...n, read: n.read || rows.get(n.id)?.read === true });
  return [...rows.values()].sort((a, b) => compareMessages(b, a));
}
