import { NextRequest, NextResponse } from "next/server";
import { addReport, getReports, updateReportStatus } from "../../../lib/data";
import { ReportStatus } from "../../../lib/types";

const reasons = ["疑似诈骗", "商品与描述不符", "违禁商品", "骚扰或辱骂", "诱导站外交易"];
const statuses: ReportStatus[] = ["待处理", "处理中", "已处理"];

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
  const target = text(body.target);
  const reason = text(body.reason);
  const note = text(body.note);

  if (!target || !reasons.includes(reason) || !note) {
    return NextResponse.json({ error: "请填写举报对象和原因" }, { status: 400 });
  }
  const report = await addReport({
    target,
    reason,
    note
  });
  return NextResponse.json(report, { status: 201 });
}

export async function GET() {
  return NextResponse.json(await getReports());
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const id = text(body.id);
  const status = text(body.status) as ReportStatus;
  if (!id || !statuses.includes(status)) {
    return NextResponse.json({ error: "请提供有效的举报 ID 和状态" }, { status: 400 });
  }
  const report = await updateReportStatus(id, status);
  if (!report) return NextResponse.json({ error: "未找到举报" }, { status: 404 });
  return NextResponse.json(report);
}
