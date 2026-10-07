import { NextResponse, after } from "next/server";
import { api, jsonBody, ApiError } from "../../../lib/http";
import { requirePerson } from "../../../lib/people";
import { rateLimit } from "../../../lib/database";
import { deliverNotifications } from "../../../lib/notifications";
import { listMessages, sendMessage } from "../../../lib/messages";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const person = await requirePerson(request),
    q = request.nextUrl.searchParams;
  const page = await listMessages(
    q.get("bookingId") || "",
    person,
    q.get("before") || "",
    Number(q.get("limit") || 200),
  );
  return NextResponse.json(page.items, {
    headers: {
      "Cache-Control": "no-store",
      "X-Has-More": String(page.hasMore),
      "X-Oldest-Message": page.oldest,
    },
  });
});
export const POST = api(async (request) => {
  const person = await requirePerson(request),
    body = await jsonBody(request);
  if (!(await rateLimit("message:" + person.id, 20, 60000)))
    throw new ApiError("发送过于频繁", 429);
  const item = await sendMessage(body, person);
  after(deliverNotifications);
  return NextResponse.json(item, { status: 201 });
});
