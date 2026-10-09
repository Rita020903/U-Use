import { NextResponse } from "next/server";
import { api, ApiError, jsonBody, text } from "../../../lib/http";
import { requirePerson } from "../../../lib/people";
import { rateLimit } from "../../../lib/database";
import { getBookings } from "../../../lib/data";
import {
  clearTimetable,
  deleteAccount,
  exportAccount,
  sendDeletionCode,
} from "../../../lib/account";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const person = await requirePerson(request);
  if (!(await rateLimit("account-export:" + person.id, 5, 3600000)))
    throw new ApiError("导出过于频繁", 429);
  return NextResponse.json(await exportAccount(person), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="uuse-account.json"',
    },
  });
});
export const POST = api(async (request) => {
  const person = await requirePerson(request);
  const body = await jsonBody(request);
  if (body.action === "clear-timetable") {
    if (!(await rateLimit("account-clear:" + person.id, 30, 60000)))
      throw new ApiError("操作过于频繁", 429);
    await clearTimetable(person);
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "send-delete-code") throw new ApiError("账号操作无效");
  const local =
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_DELIVERY === "local" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  return NextResponse.json(await sendDeletionCode(person, local), {
    headers: { "Cache-Control": "no-store" },
  });
});
export const DELETE = api(async (request) => {
  const person = await requirePerson(request);
  const body = await jsonBody(request);
  if (text(body.confirmation) !== "删除我的账号")
    throw new ApiError("请输入“删除我的账号”确认操作");
  if (!(await rateLimit("account-delete:" + person.id, 10, 3600000)))
    throw new ApiError("尝试次数过多", 429);
  await getBookings(person.id);
  await deleteAccount(person, text(body.code));
  const response = NextResponse.json({ ok: true });
  response.cookies.set("uuse-session", "", { maxAge: 0, path: "/" });
  return response;
});
