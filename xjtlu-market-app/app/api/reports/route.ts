import { NextResponse } from "next/server";
import { addReport, getReports, updateReportStatus } from "../../../lib/data";
import { ReportStatus } from "../../../lib/types";
import { requirePerson } from "../../../lib/people";
import { api, ApiError, jsonBody, text, isAdmin } from "../../../lib/http";
import { rateLimit } from "../../../lib/database";
export const dynamic = "force-dynamic";
const reasons = [
  "疑似诈骗",
  "商品与描述不符",
  "违禁商品",
  "骚扰或辱骂",
  "诱导站外交易",
];
export const POST = api(async (request) => {
  const person = await requirePerson(request),
    body = await jsonBody(request);
  if (!(await rateLimit("reports:" + person.id, 10, 3600000)))
    throw new ApiError("举报过于频繁，请稍后重试", 429);
  const target = text(body.target),
    reason = text(body.reason),
    note = text(body.note);
  if (
    !target ||
    !reasons.includes(reason) ||
    !note ||
    target.length > 120 ||
    note.length > 2000
  )
    throw new ApiError("请填写有效的举报对象、原因和说明");
  return NextResponse.json(
    await addReport({ target, reason, note, reporterId: person.id }),
    { status: 201 },
  );
});
export const GET = api(async (request) => {
  if (!isAdmin(request)) throw new ApiError("仅管理员可查看举报", 403);
  return NextResponse.json(await getReports(), {
    headers: { "Cache-Control": "no-store" },
  });
});
export const PATCH = api(async (request) => {
  if (!isAdmin(request)) throw new ApiError("仅管理员可处理举报", 403);
  const body = await jsonBody(request),
    id = text(body.id),
    status = text(body.status) as ReportStatus;
  if (!id || !["待处理", "处理中", "已处理"].includes(status))
    throw new ApiError("举报 ID 或状态无效");
  const report = await updateReportStatus(id, status);
  if (!report) throw new ApiError("未找到举报", 404);
  return NextResponse.json(report);
});
