import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  session,
  savePerson,
  assertAccount,
} from "../../../lib/people";
import { api, jsonBody } from "../../../lib/http";
import { validateTimetable, normalizedTimetable } from "../../../lib/timetable";
export const dynamic = "force-dynamic";
export const GET = api(async (request: NextRequest) => {
  return createSession(request);
});
export const POST = api(async (request: NextRequest) => {
  const person = await session(request);
  assertAccount(request, person?.id);
  if (!person)
    return NextResponse.json({ error: "请刷新后重试" }, { status: 401 });
  const timetable: unknown = await jsonBody(request, 1048576);
  if (!validateTimetable(timetable))
    return NextResponse.json(
      { error: "请检查周一开学日期、星期、时间和授课周次" },
      { status: 400 },
    );
  const normalized = normalizedTimetable(timetable);
  await savePerson({ id: person.id, timetable: normalized });
  return NextResponse.json({ ok: true });
});
export const DELETE = api(async (request: NextRequest) => {
  const person = await session(request);
  assertAccount(request, person?.id);
  if (person)
    await savePerson({
      id: person.id,
      timetable: undefined,
    });
  return NextResponse.json({ ok: true });
});
