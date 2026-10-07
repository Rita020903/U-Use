import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}
export function isAdmin(request: NextRequest) {
  if (
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.startsWith("replace-")
  )
    return false;
  const value = request.headers.get("authorization") || "";
  if (!value.startsWith("Basic ")) return false;
  try {
    const supplied = Buffer.from(value.slice(6), "base64"),
      expected = Buffer.from("admin:" + process.env.ADMIN_PASSWORD);
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  } catch {
    return false;
  }
}
export async function jsonBody(
  request: NextRequest,
  max = 64000,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("请求格式必须为 JSON", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("请求内容为空");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new ApiError("请求内容过长", 413);
      }
      chunks.push(value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("请求格式无效");
  }
}
export const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
export function api(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      if (
        error instanceof ApiError ||
        (error instanceof Error && "status" in error)
      )
        return NextResponse.json(
          {
            error: error.message,
            ...(error instanceof ApiError && error.code
              ? { code: error.code }
              : {}),
          },
          { status: Number((error as ApiError).status) || 400 },
        );
      console.error(
        "API operation failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return NextResponse.json(
        { error: "服务暂时不可用，请稍后重试" },
        { status: 503 },
      );
    }
  };
}
