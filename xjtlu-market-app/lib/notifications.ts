import { randomUUID } from "node:crypto";
import { Transaction, database } from "./database";
import { Notification, Person } from "./types";
import { mailConfigured, sendMail } from "./mail";
export async function notify(
  tx: Transaction,
  personId: string | undefined,
  title: string,
  bookingId?: string,
  needId?: string,
) {
  if (!personId) return;
  const item: Notification = {
    id: randomUUID(),
    personId,
    title,
    bookingId,
    needId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await tx.put("notifications", item.id, item);
  const person = await tx.get<Person>("people", personId);
  if (person?.email && person.verificationMode === "email" && mailConfigured())
    await tx.put("outbox", item.id, {
      id: item.id,
      to: person.email,
      title,
      attempts: 0,
      nextAttempt: Date.now(),
    });
}
export async function deliverNotifications() {
  if (!mailConfigured()) return;
  const tasks = await database(async (tx) => {
    const list = (
      await tx.list<{
        id: string;
        to: string;
        title: string;
        attempts: number;
        nextAttempt: number;
      }>("outbox")
    )
      .filter((x) => x.attempts < 5 && x.nextAttempt <= Date.now())
      .slice(0, 10);
    for (const task of list)
      await tx.put("outbox", task.id, {
        ...task,
        attempts: task.attempts + 1,
        nextAttempt: Date.now() + 300000,
      });
    return list;
  });
  for (const task of tasks)
    try {
      await sendMail(
        task.to,
        "U Use 交易通知",
        task.title + "\n请登录 U Use 查看详情。",
      );
      await database((tx) => tx.remove("outbox", task.id));
    } catch {
      /* Durable outbox retries on the next request or scheduled delivery. */
    }
}
