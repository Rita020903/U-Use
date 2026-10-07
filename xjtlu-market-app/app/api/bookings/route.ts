import { NextResponse, after } from "next/server";
import {
  addBooking,
  getBookings,
  getProducts,
  actOnBooking,
  updateBookingStatus,
} from "../../../lib/data";
import { requirePerson } from "../../../lib/people";
import { api, jsonBody, text, isAdmin, ApiError } from "../../../lib/http";
import { BookingStatus, Campus } from "../../../lib/types";
import { BookingAction } from "../../../lib/booking-rules";
import { placeFor } from "../../../lib/places";
import { deliverNotifications } from "../../../lib/notifications";
import { rateLimit } from "../../../lib/database";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const admin = isAdmin(request),
    person = admin ? undefined : await requirePerson(request);
  return NextResponse.json(await getBookings(person?.id, admin), {
    headers: { "Cache-Control": "no-store" },
  });
});
export const POST = api(async (request) => {
  const person = await requirePerson(request),
    body = await jsonBody(request);
  if (!(await rateLimit("booking:" + person.id, 10, 600000)))
    throw new ApiError("预约过于频繁，请稍后重试", 429);
  const product = (await getProducts()).find(
    (p) => p.id === text(body.productId),
  );
  if (!product) throw new ApiError("物品不存在", 404);
  const campus = text(body.campus) as Campus,
    spot = text(body.spot),
    time = text(body.time),
    returnTime = product.returnRequired ? text(body.returnTime) : time,
    note = text(body.note),
    locationId = text(body.locationId);
  if (
    !["SIP", "TAICANG"].includes(campus) ||
    !spot ||
    spot.length > 120 ||
    note.length > 2000 ||
    !time ||
    !returnTime
  )
    throw new ApiError("请填写有效的校区、地点、交付及归还时间");
  const place = placeFor(locationId);
  if (locationId && (!place || place.campus !== campus || place.label !== spot))
    throw new ApiError("交付校区与地点不一致");
  if (
    typeof body.expectedFee !== "number" ||
    typeof body.expectedDeposit !== "number" ||
    !Number.isFinite(body.expectedFee) ||
    !Number.isFinite(body.expectedDeposit) ||
    typeof body.expectedMode !== "string"
  )
    throw new ApiError("请先确认交易费用");
  const booking = await addBooking(
    {
      productId: product.id,
      productTitle: product.title,
      campus,
      spot,
      time,
      returnTime,
      note,
      locationId,
      requesterId: person.id,
      requester: person.name || "学生",
      owner: "",
      depositSnapshot: 0,
      offeredProductId: text(body.offeredProductId) || undefined,
      expectedFee: body.expectedFee,
      expectedDeposit: body.expectedDeposit,
      expectedMode: body.expectedMode,
    },
    body.requestId,
  );
  after(deliverNotifications);
  return NextResponse.json(booking, { status: 201 });
});
export const PATCH = api(async (request) => {
  const body = await jsonBody(request),
    id = text(body.id);
  if (!id) throw new ApiError("缺少预约 ID");
  if (body.status !== undefined) {
    if (!isAdmin(request))
      throw new ApiError("只有管理员可以进行仲裁状态操作", 403);
    const statuses: BookingStatus[] = [
      "待确认",
      "已确认",
      "已交付",
      "使用中",
      "待归还",
      "已归还",
      "有争议",
      "已取消",
      "已完成",
    ];
    if (!statuses.includes(body.status as BookingStatus))
      throw new ApiError("预约状态无效");
    const result = await updateBookingStatus(id, body.status as BookingStatus);
    if (!result) throw new ApiError("预约不存在", 404);
    return NextResponse.json(result);
  }
  const person = await requirePerson(request),
    action = text(body.action) as BookingAction;
  const result = await actOnBooking(id, person.id, action, text(body.reason));
  after(deliverNotifications);
  return NextResponse.json(result);
});
