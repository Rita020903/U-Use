import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host=request.headers.get("host") || request.nextUrl.host;
    const expected=process.env.APP_ORIGIN || request.nextUrl.protocol+"//"+host;
    if (origin && origin !== expected || request.headers.get("sec-fetch-site")==="cross-site")
      return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }
  const admin =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.searchParams.get("admin") === "1" ||
    (request.nextUrl.pathname === "/api/reports" && request.method === "GET");
  if (!admin) return NextResponse.next();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.startsWith("replace-"))
    return NextResponse.json({ error: "管理员登录尚未配置" }, { status: 503 });
  let credential = "";
  try {
    const value = request.headers.get("authorization") || "";
    if (value.startsWith("Basic ")) credential = atob(value.slice(6));
  } catch {}
  if (credential !== "admin:" + password)
    return new NextResponse("需要管理员登录", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="U Use Admin"' },
    });
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
