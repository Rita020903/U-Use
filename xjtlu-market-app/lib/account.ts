import {
  createHmac,
  randomInt,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { database, rateLimit } from "./database";
import { ApiError } from "./http";
import {
  Booking,
  BookingMessage,
  Person,
  Product,
  Report,
  Notification,
} from "./types";
import { Need } from "./needs";
import { sendMail, mailConfigured } from "./mail";

type DeletionCode = {
  hash: string;
  expires: number;
  attempts: number;
  email: string;
  sentAt: number;
};
function digest(id: string, code: string) {
  const secret =
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "local-development-only-uuse"
      : "");
  if (secret.length < 24 || secret.startsWith("replace-"))
    throw new ApiError("账号验证尚未配置", 503);
  return createHmac("sha256", secret)
    .update("delete:" + id + ":" + code)
    .digest("hex");
}

export async function sendDeletionCode(person: Person, local: boolean) {
  if (!person.email) throw new ApiError("账号邮箱不可用", 409);
  if (!(await rateLimit("delete-code:" + person.id, 5, 3600000)))
    throw new ApiError("验证码发送过于频繁", 429);
  if (!local && !mailConfigured())
    throw new ApiError("邮箱验证服务尚未配置", 503);
  const code = String(randomInt(100000, 1000000));
  const challenge: DeletionCode = {
    hash: digest(person.id, code),
    expires: Date.now() + 600000,
    attempts: 0,
    email: person.email,
    sentAt: Date.now(),
  };
  await database(async (tx) => {
    const previous = await tx.get<DeletionCode>("account-deletion", person.id);
    if (previous && previous.sentAt > Date.now() - 60000)
      throw new ApiError("请等待60秒后重新发送", 429);
    if (!(await tx.get<Person>("people", person.id))?.verified)
      throw new ApiError("账号已失效", 401);
    await tx.put("account-deletion", person.id, challenge);
  });
  if (!local) {
    try {
      await sendMail(
        person.email,
        "U Use 账号注销验证码",
        `注销验证码：${code}，10分钟内有效。仅在你主动注销账号时使用，请勿分享。`,
      );
    } catch {
      await database(async (tx) => {
        if (
          (await tx.get<DeletionCode>("account-deletion", person.id))?.hash ===
          challenge.hash
        )
          await tx.remove("account-deletion", person.id);
      });
      throw new ApiError("注销验证码发送失败，请重试", 503);
    }
  }
  return { ok: true, ...(local ? { localCode: code } : {}) };
}

export async function exportAccount(person: Person) {
  return database(async (tx) => {
    const current = await tx.get<Person>("people", person.id);
    if (!current?.verified) throw new ApiError("账号已失效", 401);
    const bookings = (await tx.list<Booking>("bookings")).filter(
      (b) => b.ownerId === person.id || b.requesterId === person.id,
    );
    const bookingIds = new Set(bookings.map((b) => b.id));
    return {
      format: "uuse-account-export-v1",
      exportedAt: new Date().toISOString(),
      account: current,
      products: (await tx.list<Product>("products")).filter(
        (p) => p.ownerId === person.id,
      ),
      needs: (await tx.list<Need>("needs")).filter(
        (n) => n.ownerId === person.id,
      ),
      bookings,
      messages: (await tx.list<BookingMessage>("messages")).filter((m) =>
        bookingIds.has(m.bookingId),
      ),
      notifications: (await tx.list<Notification>("notifications")).filter(
        (n) => n.personId === person.id,
      ),
      reports: (await tx.list<Report>("reports")).filter(
        (r) => r.reporterId === person.id,
      ),
    };
  });
}

export async function clearTimetable(person: Person) {
  await database(async (tx) => {
    const current = await tx.get<Person>("people", person.id);
    if (!current?.verified) throw new ApiError("账号已失效", 401);
    await tx.put("people", person.id, {
      ...current,
      timetable: undefined,
      updatedAt: Date.now(),
    });
  });
}

export async function deleteAccount(person: Person, code: string) {
  if (!/^\d{6}$/.test(code)) throw new ApiError("请输入六位注销验证码");
  const result = await database(async (tx) => {
    const current = await tx.get<Person>("people", person.id);
    if (!current?.verified) throw new ApiError("账号已失效", 401);
    const challenge = await tx.get<DeletionCode>("account-deletion", person.id);
    if (
      !challenge ||
      challenge.email !== current.email ||
      challenge.expires <= Date.now() ||
      challenge.attempts >= 5
    )
      throw new ApiError("注销验证码已过期，请重新发送", 401);
    if (
      !timingSafeEqual(
        Buffer.from(challenge.hash),
        Buffer.from(digest(person.id, code)),
      )
    ) {
      await tx.put("account-deletion", person.id, {
        ...challenge,
        attempts: challenge.attempts + 1,
      });
      return false;
    }
    const bookings = (await tx.list<Booking>("bookings")).filter(
      (b) => b.ownerId === person.id || b.requesterId === person.id,
    );
    if (
      bookings.some((b) => !["已完成", "已归还", "已取消"].includes(b.status))
    )
      throw new ApiError("还有未结束的交易或争议，请处理后再注销", 409);
    // Keep the other participant's closed transaction history; remove this account's direct identity and authored text.
    for (const b of bookings)
      await tx.put("bookings", b.id, {
        ...b,
        owner: b.ownerId === person.id ? "已注销用户" : b.owner,
        requester: b.requesterId === person.id ? "已注销用户" : b.requester,
        note: b.requesterId === person.id ? "" : b.note,
        disputeReason: undefined,
      });
    for (const m of await tx.list<BookingMessage>("messages"))
      if (m.senderId === person.id)
        await tx.put("messages", m.id, {
          ...m,
          senderName: "已注销用户",
          text: "[该用户已注销，消息内容已移除]",
        });
    const needs = (await tx.list<Need>("needs")).filter(
      (n) => n.ownerId === person.id,
    );
    const needIds = new Set(needs.map((n) => n.id));
    for (const n of needs) await tx.remove("needs", n.id);
    for (const p of await tx.list<Product>("products"))
      if (p.ownerId === person.id)
        await tx.put("products", p.id, {
          ...p,
          status: "已下架",
          title: "已注销用户的物品",
          photos: [],
          condition: "",
          spot: "",
          locationId: undefined,
          handoffCoordinates: undefined,
          returnRule: "",
          agreement: [],
          swapRule: "",
        });
    for (const r of await tx.list<Report>("reports"))
      if (r.reporterId === person.id)
        await tx.put("reports", r.id, {
          ...r,
          reporterId: undefined,
          note: "[举报人已注销]",
        });
    for (const kind of [
      "sessions",
      "presence",
      "notifications",
      "photos",
      "need-offers",
      "outbox",
    ])
      for (const { id, value } of await tx.entries<{
        personId?: string;
        ownerId?: string;
        needId?: string;
        to?: string;
      }>(kind))
        if (
          value.personId === person.id ||
          value.ownerId === person.id ||
          (kind === "need-offers" && needIds.has(value.needId || "")) ||
          (kind === "outbox" && value.to === current.email)
        )
          await tx.remove(kind, id);
    for (const { id } of await tx.entries("submissions"))
      if (id.split(":")[1] === person.id) await tx.remove("submissions", id);
    if (current.email) {
      await tx.remove("emails", current.email);
      await tx.remove("otp", current.email);
    }
    await tx.remove("account-deletion", person.id);
    await tx.put("deleted-accounts", person.id, {
      at: new Date().toISOString(),
    });
    await tx.remove("people", person.id);
    const auditId = randomUUID();
    await tx.put("audit", auditId, {
      id: auditId,
      action: "account-deleted",
      personId: person.id,
      at: new Date().toISOString(),
    });
    return true;
  });
  if (!result) throw new ApiError("注销验证码不正确", 401);
}
