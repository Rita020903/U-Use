import { NextRequest, NextResponse } from "next/server";
import { addBooking, getBookings, getProducts, updateBookingStatus } from "../../../lib/data";
import { BookingStatus, Campus } from "../../../lib/types";

const campuses: Campus[] = ["SIP", "TAICANG"];
const statuses: BookingStatus[] = ["待确认", "已确认", "已交付", "使用中", "待归还", "已归还", "有争议", "已取消"];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const productId = text(body.productId);
  const campus = text(body.campus);
  const spot = text(body.spot);
  const time = text(body.time);
  const returnTime = text(body.returnTime);
  const note = text(body.note);

  if (!productId || !campuses.includes(campus as Campus) || !spot || !time || !returnTime) {
    return NextResponse.json({ error: "请填写商品、校区、地点、借出时间和归还时间" }, { status: 400 });
  }
  const product = (await getProducts()).find((item) => item.id === productId);
  const booking = await addBooking({
    productId,
    productTitle: product?.title ?? "手动借还单",
    campus: campus as Campus,
    spot,
    time,
    returnTime,
    note,
    requester: text(body.requester) || "林同学",
    owner: text(body.owner) || "待确认",
    depositSnapshot: product?.deposit ?? 0
  });
  return NextResponse.json(booking, { status: 201 });
}

export async function GET() {
  return NextResponse.json(await getBookings());
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const id = text(body.id);
  const status = text(body.status) as BookingStatus;
  if (!id || !statuses.includes(status)) {
    return NextResponse.json({ error: "请提供有效的预约 ID 和状态" }, { status: 400 });
  }
  const booking = await updateBookingStatus(id, status);
  if (!booking) return NextResponse.json({ error: "未找到预约" }, { status: 404 });
  return NextResponse.json(booking);
}
