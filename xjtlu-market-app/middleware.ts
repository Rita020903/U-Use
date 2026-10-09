import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "./lib/http";
import { rateLimit } from "./lib/database";
export async function middleware(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") || request.nextUrl.host;
    const expected =
      process.env.APP_ORIGIN || request.nextUrl.protocol + "//" + host;
    if (
      (origin && origin !== expected) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }
  const admin =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.searchParams.get("admin") === "1" ||
    (request.nextUrl.pathname === "/api/reports" && request.method === "GET") ||
    request.nextUrl.pathname.startsWith("/api/admin/") ||
    request.headers.get("authorization")?.startsWith("Basic ");
  if (!admin) return NextResponse.next();
  const password = process.env.ADMIN_PASSWORD;
  if (
    !password ||
    password.startsWith("replace-") ||
    (process.env.NODE_ENV === "production" && password.length < 24)
  )
    return NextResponse.json({ error: "管理员登录尚未配置" }, { status: 503 });
  if (!isAdmin(request)) {
    // Correct credentials remain usable even when the failed-attempt budget is exhausted.
    if (request.headers.has("authorization")) {
      try {
        if (!(await rateLimit("admin-failed-login", 30, 60000)))
          return NextResponse.json(
            { error: "管理员登录尝试过多，请稍后重试" },
            {
              status: 429,
              headers: { "Retry-After": "60", "Cache-Control": "no-store" },
            },
          );
      } catch {
        return NextResponse.json(
          { error: "认证服务暂时不可用" },
          { status: 503 },
        );
      }
    }
    return new NextResponse("需要管理员登录", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="U Use Admin"',
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
  runtime: "nodejs",
};
