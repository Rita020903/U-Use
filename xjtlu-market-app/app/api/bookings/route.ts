import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  addBooking,
  BookingError,
  getBookings,
  getProducts,
  updateBookingStatus,
} from "../../../lib/data";
import { BookingStatus, Campus } from "../../../lib/types";

const campuses: Campus[] = ["SIP", "TAICANG"];
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const productId = text(body.productId);
  const campus = text(body.campus);
  const spot = text(body.spot);
  const time = text(body.time);
  const returnTime = text(body.returnTime);
  const note = text(body.note);

  if (!productId || !campuses.includes(campus as Campus) || !spot || !time) {
    return NextResponse.json(
      { error: "请填写商品、校区、地点、借出时间和归还时间" },
      { status: 400 },
    );
  }
  const product = (await getProducts()).find((item) => item.id === productId);
  if (!product)
    return NextResponse.json({ error: "物品不存在" }, { status: 404 });
  if (product.returnRequired && !returnTime)
    return NextResponse.json({ error: "请填写归还时间" }, { status: 400 });
  if (spot.length > 120 || note.length > 2000)
    return NextResponse.json({ error: "地点或备注过长" }, { status: 400 });
  try {
    const booking = await addBooking({
      productId,
      productTitle: product?.title ?? "手动借还单",
      campus: campus as Campus,
      spot,
      time,
      returnTime: product.returnRequired ? returnTime : time,
      note,
      requester: "试用用户",
      owner: "物品发布者",
      depositSnapshot: product?.deposit ?? 0,
    });
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof BookingError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json({ error: "保存失败，请重试" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(await getBookings());
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const id = text(body.id);
  const status = text(body.status) as BookingStatus;
  if (!id || !statuses.includes(status)) {
    return NextResponse.json(
      { error: "请提供有效的预约 ID 和状态" },
      { status: 400 },
    );
  }
  try {
    const booking = await updateBookingStatus(id, status);
    if (!booking)
      return NextResponse.json({ error: "未找到预约" }, { status: 404 });
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof BookingError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json({ error: "保存失败，请重试" }, { status: 500 });
  }
}
