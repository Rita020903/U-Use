import { NextRequest, NextResponse } from "next/server";
import {
  randomInt,
  randomBytes,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { database, rateLimit } from "../../../lib/database";
import { api, ApiError, jsonBody, text } from "../../../lib/http";
import { Person } from "../../../lib/types";
import {
  session,
  sessionKey,
  setSessionCookie,
  assertAccount,
} from "../../../lib/people";
import { mailConfigured, sendMail } from "../../../lib/mail";
export const dynamic = "force-dynamic";
type Challenge = {
  hash: string;
  expires: number;
  attempts: number;
  sentAt: number;
  delivery: "email" | "local";
};
function digest(email: string, code: string) {
  const secret =
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "local-development-only-uuse"
      : "");
  if (secret.length < 24 || secret.startsWith("replace-"))
    throw new ApiError("请配置至少 24 字符的 AUTH_SECRET", 503);
  return createHmac("sha256", secret)
    .update(email + ":" + code)
    .digest("hex");
}
export const POST = api(async (request: NextRequest) => {
  assertAccount(request, (await session(request))?.id);
  const body = await jsonBody(request),
    email = text(body.email).toLowerCase(),
    action = text(body.action);
  const allowed = (process.env.STUDENT_EMAIL_DOMAINS || "student.xjtlu.edu.cn")
    .split(",")
    .map((s) => s.trim());
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/.test(email) ||
    email.length > 254 ||
    !allowed.includes(email.split("@")[1])
  )
    throw new ApiError("请输入西浦学生邮箱");
  if (!(await rateLimit("auth:" + email, 20, 3600000)))
    throw new ApiError("尝试次数过多，请稍后重试", 429);
  if (action === "send") {
    if (!(await rateLimit("auth-send-global", 100, 3600000)))
      throw new ApiError("验证码服务繁忙，请稍后重试", 429);
    const local =
      process.env.AUTH_DELIVERY === "local" &&
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
    if (!local && !mailConfigured())
      throw new ApiError("邮箱验证服务尚未配置，请联系管理员", 503);
    if (!(await rateLimit("auth-send:" + email, 5, 3600000)))
      throw new ApiError("验证码发送过于频繁，请一小时后重试", 429);
    const code = String(randomInt(100000, 1000000)),
      challenge: Challenge = {
        hash: digest(email, code),
        expires: Date.now() + 600000,
        attempts: 0,
        sentAt: Date.now(),
        delivery: local ? "local" : "email",
      };
    await database(async (tx) => {
      const old = await tx.get<Challenge>("otp", email);
      if (old && old.sentAt > Date.now() - 60000)
        throw new ApiError("请等待 60 秒后再发送", 429);
      await tx.put("otp", email, challenge);
    });
    if (!local) {
      try {
        await sendMail(
          email,
          "U Use 登录验证码",
          `你的验证码是 ${code}，10 分钟内有效。请勿分享验证码。`,
        );
      } catch {
        await database(async (tx) => {
          if ((await tx.get<Challenge>("otp", email))?.hash === challenge.hash)
            await tx.remove("otp", email);
        });
        throw new ApiError("验证码邮件发送失败，请重试", 503);
      }
    }
    return NextResponse.json(
      { ok: true, ...(local ? { localCode: code, local: true } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (action !== "verify") throw new ApiError("登录操作无效");
  const code = text(body.code),
    name = text(body.name);
  if (!/^\d{6}$/.test(code) || name.length > 40)
    throw new ApiError("请填写六位验证码，昵称不能超过 40 字");
  const previous = await session(request),
    token = randomBytes(32).toString("hex");
  const result = await database(async (tx) => {
    const challenge = await tx.get<Challenge>("otp", email);
    if (!challenge || challenge.expires < Date.now() || challenge.attempts >= 5)
      return { error: "验证码已过期，请重新发送" };
    const valid = timingSafeEqual(
      Buffer.from(challenge.hash),
      Buffer.from(digest(email, code)),
    );
    if (!valid) {
      await tx.put("otp", email, {
        ...challenge,
        attempts: challenge.attempts + 1,
      });
      return { error: "验证码不正确" };
    }
    const account = await tx.get<{ id: string }>("emails", email),
      existing = account
        ? await tx.get<Person>("people", account.id)
        : undefined;
    const guest = previous && !previous.verified ? previous : undefined;
    const person: Person = {
      ...existing,
      id: existing?.id || guest?.id || randomUUID(),
      email,
      name: name || existing?.name || email.split("@")[0],
      verified: true,
      verificationMode: challenge.delivery,
      timetable: existing?.timetable || guest?.timetable,
      updatedAt: Date.now(),
    };
    await tx.put("people", person.id, person);
    await tx.put("emails", email, { id: person.id });
    await tx.remove("otp", email);
    await tx.put("sessions", sessionKey(token), {
      personId: person.id,
      expiresAt: Date.now() + 30 * 86400000,
    });
    const old = request.cookies.get("uuse-session")?.value;
    if (old) await tx.remove("sessions", sessionKey(old));
    return { person };
  });
  if ("error" in result) throw new ApiError(result.error || "登录失败", 401);
  const response = NextResponse.json(result.person, {
    headers: { "Cache-Control": "no-store" },
  });
  setSessionCookie(response, request, token);
  return response;
});
export const DELETE = api(async (request) => {
  const token = request.cookies.get("uuse-session")?.value,
    person = await session(request);
  assertAccount(request, person?.id);
  await database(async (tx) => {
    if (token) await tx.remove("sessions", sessionKey(token));
    if (person)
      for (const p of await tx.list<{ personId: string; leaseId: string }>(
        "presence",
      ))
        if (p.personId === person.id)
          await tx.remove("presence", p.personId + ":" + p.leaseId);
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("uuse-session", "", { maxAge: 0, path: "/" });
  return response;
});
