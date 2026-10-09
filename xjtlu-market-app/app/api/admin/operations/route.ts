import { NextResponse, after } from "next/server";
import { api, ApiError, isAdmin, jsonBody, text } from "../../../../lib/http";
import { database, rateLimit } from "../../../../lib/database";
import {
  mailQueue,
  retryMail,
  deliverNotifications,
} from "../../../../lib/notifications";
import { mailConfigured } from "../../../../lib/mail";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  if (!isAdmin(request)) throw new ApiError("仅管理员可查看运行状态", 403);
  const maintenance = await database((tx) =>
    tx.get<{ at: string; removed: number }>("meta", "last-maintenance"),
  );
  return NextResponse.json(
    {
      mailConfigured: mailConfigured(),
      maintenance: maintenance || null,
      queue: (await mailQueue()).slice(0, 100),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
export const POST = api(async (request) => {
  if (!isAdmin(request)) throw new ApiError("仅管理员可重试邮件", 403);
  if (!(await rateLimit("admin-mail-retry", 20, 60000)))
    throw new ApiError("操作过于频繁", 429);
  const body = await jsonBody(request);
  const id = text(body.id);
  if (!id || id.length > 100) throw new ApiError("邮件编号无效");
  await retryMail(id);
  after(deliverNotifications);
  return NextResponse.json({ ok: true });
});
