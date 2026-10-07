import { randomBytes, randomUUID, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database, rateLimit } from "./database";
import { Person } from "./types";
import { ApiError } from "./http";
export const sessionKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function assertAccount(request: NextRequest, personId?: string) {
  const expected = request.headers.get("x-uuse-account");
  if (expected && expected !== personId)
    throw new ApiError("账号已切换，请刷新页面后重试", 409, "ACCOUNT_CHANGED");
}
export async function session(
  request: NextRequest,
): Promise<Person | undefined> {
  const token = request.cookies.get("uuse-session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  return database(async (tx) => {
    const entry = await tx.get<{ personId: string; expiresAt: number }>(
      "sessions",
      sessionKey(token),
    );
    return entry && entry.expiresAt > Date.now()
      ? tx.get<Person>("people", entry.personId)
      : undefined;
  });
}
export async function requirePerson(request: NextRequest) {
  const person = await session(request);
  assertAccount(request, person?.id);
  if (
    !person?.verified ||
    (process.env.NODE_ENV === "production" &&
      person.verificationMode !== "email")
  )
    throw new ApiError("请先用西浦邮箱登录", 401);
  return person;
}
export async function savePerson(person: Pick<Person, "id"> & Partial<Person>) {
  return database(async (tx) => {
    const current = await tx.get<Person>("people", person.id);
    if (!current) throw new ApiError("会话已失效，请重新登录", 401);
    await tx.put("people", person.id, {
      ...current,
      ...person,
      updatedAt: Date.now(),
    });
  });
}
export function setSessionCookie(
  response: NextResponse,
  request: NextRequest,
  token: string,
) {
  response.cookies.set("uuse-session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" &&
      request.nextUrl.protocol === "https:",
    maxAge: 30 * 86400,
    path: "/",
  });
}
export async function createSession(request: NextRequest) {
  const existing = await session(request);
  assertAccount(request, existing?.id);
  if (existing)
    return NextResponse.json(existing, {
      headers: { "Cache-Control": "no-store" },
    });
  if (!(await rateLimit("new-session", 300, 60000)))
    throw new ApiError("服务繁忙，请稍后重试", 429);
  const token = randomBytes(32).toString("hex"),
    person: Person = { id: randomUUID(), updatedAt: Date.now() };
  await database(async (tx) => {
    await tx.put("people", person.id, person);
    await tx.put("sessions", sessionKey(token), {
      personId: person.id,
      expiresAt: Date.now() + 30 * 86400000,
    });
  });
  const response = NextResponse.json(
    { ...person, verified: false, timetable: null },
    { headers: { "Cache-Control": "no-store" } },
  );
  setSessionCookie(response, request, token);
  return response;
}
export async function timetableFor(id?: string) {
  return id
    ? database(async (tx) => (await tx.get<Person>("people", id))?.timetable)
    : undefined;
}
