import { NextResponse, after } from "next/server";
import { api, ApiError, jsonBody, text, isAdmin } from "../../../lib/http";
import { requirePerson, session, assertAccount } from "../../../lib/people";
import { rateLimit } from "../../../lib/database";
import {
  createNeed,
  finishNeed,
  listNeeds,
  offerProduct,
  hideNeed,
  reviewNeed,
} from "../../../lib/needs";
import { Campus } from "../../../lib/types";
import { deliverNotifications } from "../../../lib/notifications";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const reviewId = request.nextUrl.searchParams.get("reviewId");
  if (reviewId) {
    if (!isAdmin(request)) throw new ApiError("仅管理员可查看审核内容", 403);
    return NextResponse.json(await reviewNeed(reviewId), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const q = request.nextUrl.searchParams,
    campus = q.get("campus") || "SIP",
    mine = q.get("mine") === "1",
    offset = Number(q.get("offset") || 0);
  if (
    !["SIP", "TAICANG"].includes(campus) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1000000
  )
    throw new ApiError("求物筛选参数无效");
  const person = mine ? await requirePerson(request) : await session(request);
  assertAccount(request, person?.id);
  return NextResponse.json(
    await listNeeds(campus as Campus, person?.id, mine, offset),
    { headers: { "Cache-Control": "no-store" } },
  );
});
export const POST = api(async (request) => {
  const person = await requirePerson(request);
  if (!(await rateLimit("need-publish:" + person.id, 10, 3600000)))
    throw new ApiError("发布过于频繁，请稍后重试", 429);
  return NextResponse.json(await createNeed(await jsonBody(request), person), {
    status: 201,
  });
});
export const PATCH = api(async (request) => {
  const body = await jsonBody(request),
    id = text(body.id);
  if (!id) throw new ApiError("缺少求物 ID");
  if (body.action === "hide") {
    if (!isAdmin(request)) throw new ApiError("仅管理员可隐藏求物", 403);
    const result = await hideNeed(id);
    after(deliverNotifications);
    return NextResponse.json(result);
  }
  const person = await requirePerson(request);
  if (body.action === "offer") {
    if (!(await rateLimit("need-offer:" + person.id, 20, 3600000)))
      throw new ApiError("回应过于频繁，请稍后重试", 429);
    const result = await offerProduct(id, text(body.productId), person);
    after(deliverNotifications);
    return NextResponse.json(result);
  }
  if (body.action !== "resolved" && body.action !== "withdrawn")
    throw new ApiError("求物操作无效");
  return NextResponse.json(await finishNeed(id, person, body.action));
});
