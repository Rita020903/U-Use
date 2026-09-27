import { NextRequest, NextResponse } from "next/server";
import { Campus } from "../../../lib/types";

const bookings: Record<string, unknown>[] = [];
const campuses: Campus[] = ["SIP", "TAICANG"];

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
  const note = text(body.note);

  if (!productId || !campuses.includes(campus as Campus) || !spot || !time) {
    return NextResponse.json({ error: "请填写商品、校区、地点和时间" }, { status: 400 });
  }
  const booking = {
    id: `b${Date.now()}`,
    productId,
    campus,
    spot,
    time,
    note,
    status: "待确认",
    createdAt: new Date().toISOString()
  };
  bookings.unshift(booking);
  return NextResponse.json(booking, { status: 201 });
}

export async function GET() {
  return NextResponse.json(bookings);
}
