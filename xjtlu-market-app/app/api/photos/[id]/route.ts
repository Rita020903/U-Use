import { NextRequest, NextResponse } from "next/server";
import { database } from "../../../../lib/database";
import { session } from "../../../../lib/people";
import { Product } from "../../../../lib/types";
import { isAdmin, api } from "../../../../lib/http";
export const dynamic = "force-dynamic";
export const GET = api(async (request: NextRequest) => {
  const id = request.nextUrl.pathname.split("/").pop() || "";
  if (!/^[a-f0-9-]{36}$/.test(id))
    return new NextResponse(null, { status: 404 });
  const person = await session(request);
  const image = await database(async (tx) => {
    const photo = await tx.get<{ ownerId: string; data: string }>("photos", id);
    if (!photo) return;
    if (
      !isAdmin(request) &&
      photo.ownerId !== person?.id &&
      !(await tx.list<Product>("products")).some(
        (p) => p.status === "可用" && p.photos?.includes("/api/photos/" + id),
      )
    )
      return;
    return photo.data;
  });
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(image, "base64")), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
