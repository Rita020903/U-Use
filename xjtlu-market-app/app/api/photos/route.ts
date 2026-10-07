import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requirePerson } from "../../../lib/people";
import { api, ApiError } from "../../../lib/http";
import { database, rateLimit } from "../../../lib/database";
export const dynamic = "force-dynamic";
export const POST = api(async (request) => {
  const person = await requirePerson(request);
  if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
    throw new ApiError("照片不能超过 5 MB", 413);
  if (!(await rateLimit("photos:" + person.id, 30, 3600000)))
    throw new ApiError("上传过于频繁", 429);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("请选择照片");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 6 * 1024 * 1024) {
      await reader.cancel();
      throw new ApiError("照片不能超过 5 MB", 413);
    }
    chunks.push(value);
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new ApiError("照片请求格式无效");
  }
  const file = form.get("photo");
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new ApiError("请选择 5 MB 以内的 JPG、PNG 或 WebP 照片");
  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 24000000,
    })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ApiError("照片损坏或像素过大，请重新选择");
  }
  if (image.length > 2 * 1024 * 1024)
    throw new ApiError("照片内容过大，请压缩后上传");
  const id = randomUUID();
  await database((tx) =>
    tx.put("photos", id, {
      id,
      ownerId: person.id,
      data: image.toString("base64"),
      createdAt: Date.now(),
    }),
  );
  return NextResponse.json({ url: "/api/photos/" + id }, { status: 201 });
});
