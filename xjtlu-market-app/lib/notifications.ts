import { randomUUID } from "node:crypto";
import { Transaction, database } from "./database";
import { Notification, Person } from "./types";
import { mailConfigured, sendMail } from "./mail";
import { ApiError } from "./http";
export type MailTask = {
  id: string;
  personId?: string;
  to: string;
  title: string;
  attempts: number;
  nextAttempt: number;
  leaseId?: string;
  leaseUntil?: number;
  failedAt?: number;
};
export async function mailQueue() {
  return database(async (tx) =>
    (await tx.list<MailTask>("outbox")).sort(
      (a, b) => b.nextAttempt - a.nextAttempt,
    ),
  );
}
export async function retryMail(id: string) {
  return database(async (tx) => {
    const task = await tx.get<MailTask>("outbox", id);
    if (!task) throw new ApiError("邮件已处理或不存在", 404);
    if (task.attempts < 5 || (task.leaseUntil || 0) > Date.now())
      throw new ApiError("邮件仍在等待投递，请勿重复重试", 409);
    await tx.put("outbox", id, {
      ...task,
      attempts: 0,
      nextAttempt: Date.now(),
      leaseId: undefined,
      leaseUntil: undefined,
      failedAt: undefined,
    });
    const auditId = randomUUID();
    await tx.put("audit", auditId, {
      id: auditId,
      actor: "admin",
      action: "retry-mail",
      mailId: id,
      at: new Date().toISOString(),
    });
  });
}
export async function notify(
  tx: Transaction,
  personId: string | undefined,
  title: string,
  bookingId?: string,
  needId?: string,
) {
  if (!personId) return;
  if (await tx.get("deleted-accounts", personId)) return;
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
      personId,
      to: person.email,
      title,
      attempts: 0,
      nextAttempt: Date.now(),
    });
}
export async function deliverNotifications() {
  if (!mailConfigured()) return;
  const tasks = await database(async (tx) => {
    const list = (await tx.list<MailTask>("outbox"))
      .filter(
        (x) =>
          x.attempts < 5 &&
          x.nextAttempt <= Date.now() &&
          (x.leaseUntil || 0) <= Date.now(),
      )
      .slice(0, 10);
    for (const task of list) {
      task.leaseId = randomUUID();
      task.leaseUntil = Date.now() + 300000;
      await tx.put("outbox", task.id, {
        ...task,
      });
    }
    return list;
  });
  for (const task of tasks) {
    const current = await database((tx) => tx.get<MailTask>("outbox", task.id));
    if (!current || current.leaseId !== task.leaseId) continue;
    try {
      await sendMail(
        task.to,
        "U Use 交易通知",
        task.title + "\n请登录 U Use 查看详情。",
      );
      await database(async (tx) => {
        if (
          (await tx.get<MailTask>("outbox", task.id))?.leaseId === task.leaseId
        )
          await tx.remove("outbox", task.id);
      });
    } catch {
      await database(async (tx) => {
        const current = await tx.get<MailTask>("outbox", task.id);
        if (!current || current.leaseId !== task.leaseId) return;
        const attempts = current.attempts + 1;
        await tx.put("outbox", task.id, {
          ...current,
          attempts,
          nextAttempt: Date.now() + Math.min(3600000, 60000 * 2 ** attempts),
          leaseId: undefined,
          leaseUntil: undefined,
          failedAt: attempts >= 5 ? Date.now() : undefined,
        });
      });
    }
  }
}
