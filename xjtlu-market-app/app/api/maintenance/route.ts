import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { api, ApiError } from "../../../lib/http";
import { database } from "../../../lib/database";
import { getBookings } from "../../../lib/data";
import { deliverNotifications } from "../../../lib/notifications";
import { Product } from "../../../lib/types";
export const dynamic = "force-dynamic";
export const POST = api(async (request) => {
  const secret = process.env.CRON_SECRET,
    value = request.headers.get("authorization") || "";
  if (
    !secret ||
    secret.length < 24 ||
    secret.startsWith("replace-") ||
    Buffer.byteLength(value) !== Buffer.byteLength("Bearer " + secret) ||
    !timingSafeEqual(Buffer.from(value), Buffer.from("Bearer " + secret))
  )
    throw new ApiError("无权执行维护任务", 403);
  await getBookings(undefined, true);
  await deliverNotifications();
  const removed = await database(async (tx) => {
    let count = 0;
    const now = Date.now();
    for (const kind of ["sessions", "otp", "limits", "presence"])
      for (const { id, value } of await tx.entries<Record<string, unknown>>(
        kind,
      )) {
        const until = Number(
          value.expiresAt ||
            value.expires ||
            value.until ||
            Number(value.updatedAt) + 120000,
        );
        if (!Number.isFinite(until) || until > now) continue;
        await tx.remove(kind, id);
        count++;
      }
    const photos = new Set(
      (await tx.list<Product>("products")).flatMap((p) => p.photos || []),
    );
    for (const { id, value } of await tx.entries<{ createdAt: number }>(
      "photos",
    ))
      if (
        !photos.has("/api/photos/" + id) &&
        value.createdAt < now - 30 * 86400000
      ) {
        await tx.remove("photos", id);
        count++;
      }
    for (const { id, value } of await tx.entries<{
      read: boolean;
      createdAt: string;
    }>("notifications"))
      if (value.read && Date.parse(value.createdAt) < now - 90 * 86400000) {
        await tx.remove("notifications", id);
        count++;
      }
    return count;
  });
  return NextResponse.json({ ok: true, removed });
});
