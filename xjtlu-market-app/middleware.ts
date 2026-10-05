import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin)
      return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 16000)
      return NextResponse.json({ error: "请求内容过长" }, { status: 413 });
  }
  const password = process.env.ADMIN_PASSWORD;
  const protectedRoute =
    url.pathname.startsWith("/admin") ||
    request.method === "PATCH" ||
    url.searchParams.get("admin") === "1" ||
    (url.pathname === "/api/reports" && request.method === "GET");
  // Public write/read access is restricted to an explicitly enabled local demo.
  if (
    !protectedRoute &&
    (process.env.DEMO_MODE === "true" || process.env.NODE_ENV === "development")
  )
    return NextResponse.next();
  if (
    !protectedRoute &&
    request.method === "GET" &&
    url.pathname === "/api/products"
  )
    return NextResponse.next();
  if (!password)
    return NextResponse.json(
      { error: "请先配置管理员登录，或启用本地试用模式" },
      { status: 503 },
    );
  const authorization = request.headers.get("authorization") || "";
  let credential = "";
  try {
    if (authorization.startsWith("Basic "))
      credential = new TextDecoder().decode(Uint8Array.from(atob(authorization.slice(6)), character => character.charCodeAt(0)));
  } catch {}
  if (credential !== `admin:${password}`)
    return new NextResponse("需要管理员登录", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="U Use Admin", charset="UTF-8"',
      },
    });
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
