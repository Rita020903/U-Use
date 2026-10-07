import { NextResponse } from "next/server";
import { requirePerson } from "../../../lib/people";
import { api, ApiError, jsonBody, text } from "../../../lib/http";
import { database, rateLimit } from "../../../lib/database";
import { Presence, coarsePosition, PRESENCE_TTL } from "../../../lib/presence";
import { distanceKm } from "../../../lib/places";
import { Person } from "../../../lib/types";
export const dynamic = "force-dynamic";
const centers = {
  SIP: { lat: 31.27558, lng: 120.73584 },
  TAICANG: { lat: 31.48303, lng: 121.15569 },
};
function point(lat: unknown, lng: unknown, campus: unknown) {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !["SIP", "TAICANG"].includes(String(campus)) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new ApiError("坐标或校区无效");
  const p = coarsePosition(lat, lng);
  return { ...p, campus: campus as Presence["campus"] };
}
export const GET = api(async (request) => {
  const person = await requirePerson(request),
    q = request.nextUrl.searchParams;
  if (!q.has("lat") || !q.has("lng"))
    throw new ApiError("查询附近用户需要当前位置的模糊网格");
  const p = point(Number(q.get("lat")), Number(q.get("lng")), q.get("campus"));
  if (!(await rateLimit("nearby:" + person.id, 10, 60000)))
    throw new ApiError("查询过于频繁，请稍后重试", 429);
  if (distanceKm(p, centers[p.campus]) > 10)
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  const list = await database(async (tx) => {
    const rows = await tx.list<Presence>("presence"),
      latest = new Map<string, Presence>();
    for (const row of rows) {
      if (row.updatedAt <= Date.now() - PRESENCE_TTL) {
        await tx.remove("presence", row.personId + ":" + row.leaseId);
        continue;
      }
      if (
        row.personId === person.id ||
        row.campus !== p.campus ||
        distanceKm(p, row) > 5
      )
        continue;
      if ((latest.get(row.personId)?.updatedAt || 0) < row.updatedAt)
        latest.set(row.personId, row);
    }
    const result = [];
    for (const row of [...latest.values()]
      .sort((a, b) => distanceKm(p, a) - distanceKm(p, b))
      .slice(0, 40)) {
      const owner = await tx.get<Person>("people", row.personId);
      if (owner?.verified)
        result.push({
          id: row.personId,
          name: owner.name || "附近同学",
          lat: row.lat,
          lng: row.lng,
          updatedAt: row.updatedAt,
        });
    }
    return result;
  });
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
});
export const POST = api(async (request) => {
  const person = await requirePerson(request),
    body = await jsonBody(request),
    p = point(body.lat, body.lng, body.campus),
    leaseId = text(body.leaseId);
  if (!/^[a-f0-9-]{36}$/.test(leaseId)) throw new ApiError("位置会话无效");
  if (distanceKm(p, centers[p.campus]) > 10)
    throw new ApiError("当前位置不在所选校区周边，不能分享为该校区用户");
  if (!(await rateLimit("presence:" + person.id, 10, 60000)))
    throw new ApiError("位置更新过于频繁", 429);
  await database((tx) =>
    tx.put("presence", person.id + ":" + leaseId, {
      ...p,
      personId: person.id,
      leaseId,
      updatedAt: Date.now(),
    }),
  );
  return NextResponse.json({ ok: true });
});
export const DELETE = api(async (request) => {
  const person = await requirePerson(request),
    body = await jsonBody(request),
    leaseId = text(body.leaseId);
  if (!/^[a-f0-9-]{36}$/.test(leaseId)) throw new ApiError("位置会话无效");
  await database((tx) => tx.remove("presence", person.id + ":" + leaseId));
  return NextResponse.json({ ok: true });
});
