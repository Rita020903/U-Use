import { NextRequest, NextResponse } from "next/server";
import { getBookings, getProducts } from "../../../lib/data";
import { requirePerson, timetableFor } from "../../../lib/people";
import { api, ApiError } from "../../../lib/http";
import { Campus } from "../../../lib/types";
import { recommendations } from "../../../lib/matching";
import { rateLimit } from "../../../lib/database";
export const dynamic = "force-dynamic";
export const GET = api(async (request: NextRequest) => {
  const person = await requirePerson(request);
  if (!(await rateLimit("matching:" + person.id, 30, 60000)))
    throw new ApiError("匹配过于频繁，请稍后重试", 429);
  if (!person?.timetable)
    return NextResponse.json(
      { error: "请先到「我的」导入并确认课表", needsTimetable: true },
      { status: 400 },
    );
  const product = (await getProducts()).find(
    (p) =>
      p.id === request.nextUrl.searchParams.get("productId") &&
      p.status === "可用",
  );
  if (!product)
    return NextResponse.json({ error: "物品暂不可预约" }, { status: 404 });
  if (product.ownerId === person.id)
    return NextResponse.json(
      { error: "这是你发布的物品，无需预约自己" },
      { status: 409 },
    );
  const other = await timetableFor(product.ownerId);
  const query = request.nextUrl.searchParams;
  const campus = query.get("campus"),
    currentCampus = query.get("currentCampus"),
    hours = Number(query.get("returnAfterHours") || 24);
  if (
    (campus && !["SIP", "TAICANG"].includes(campus)) ||
    (currentCampus && !["SIP", "TAICANG"].includes(currentCampus)) ||
    !Number.isFinite(hours) ||
    hours < 0.5 ||
    hours > 24 * 30
  )
    throw new ApiError("匹配参数无效");
  return NextResponse.json(
    {
      items: recommendations(
        product,
        person.timetable,
        other,
        await getBookings(undefined, true),
        Date.now(),
        {
          personId: person.id,
          campus: (campus || undefined) as Campus | undefined,
          currentCampus: (currentCampus || undefined) as Campus | undefined,
          returnAfterHours: hours,
        },
      ),
      mutual: !!other,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
