import { NextRequest, NextResponse } from "next/server";
import { addProduct, getProducts } from "../../../lib/data";
import { AccessMode, Campus } from "../../../lib/types";

const campuses: Campus[] = ["SIP", "TAICANG"];
const accessModes: AccessMode[] = ["buy", "borrow", "rent", "swap"];

function isCampus(value: unknown): value is Campus {
  return typeof value === "string" && campuses.includes(value as Campus);
}

function isAccessMode(value: unknown): value is AccessMode {
  return typeof value === "string" && accessModes.includes(value as AccessMode);
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function validDateRange(from: string, to: string) {
  if (!from || !to) return false;
  const start = new Date(from);
  const end = new Date(to);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end;
}

function sortValue(item: Awaited<ReturnType<typeof getProducts>>[number]) {
  if (item.accessMode === "rent") return item.rentPrice ?? 0;
  if (item.accessMode === "buy") return item.price;
  return item.deposit;
}

/** 种子数据的 id 是 p1..p14，新发布的 id 是 p + 时间戳，用数字部分就能排出“最新发布”。 */
function recentValue(item: Awaited<ReturnType<typeof getProducts>>[number]) {
  const digits = item.id.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const campus = query.get("campus") as Campus | null;
  const scope = query.get("scope") ?? "local";
  const category = query.get("category");
  const search = query.get("search")?.toLowerCase() ?? "";
  const accessMode = query.get("accessMode");
  const sort = query.get("sort") ?? "near";

  if (campus && !isCampus(campus)) return NextResponse.json({ error: "校区参数无效" }, { status: 400 });
  if (scope !== "local" && scope !== "cross") return NextResponse.json({ error: "浏览范围参数无效" }, { status: 400 });
  if (accessMode && accessMode !== "all" && !isAccessMode(accessMode)) return NextResponse.json({ error: "使用方式参数无效" }, { status: 400 });

  let products = (await getProducts()).filter((item) => item.status === "可用");
  if (campus) products = products.filter((item) => scope === "cross" ? item.campus !== campus && item.crossCampus : item.campus === campus);
  if (category && category !== "全部") products = products.filter((item) => item.category === category);
  if (accessMode && accessMode !== "all") products = products.filter((item) => item.accessMode === accessMode);
  if (search) products = products.filter((item) => `${item.title}${item.category}${item.spot}${item.condition}${item.availabilityLabel}`.toLowerCase().includes(search));
  if (sort === "near") products.sort((a, b) => a.distanceKm - b.distanceKm);
  if (sort === "new") products.sort((a, b) => recentValue(b) - recentValue(a));
  if (sort === "high") products.sort((a, b) => sortValue(b) - sortValue(a));
  if (sort === "low") products.sort((a, b) => sortValue(a) - sortValue(b));
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const title = cleanText(body.title);
  const spot = cleanText(body.spot);
  const condition = cleanText(body.condition, "待补充");
  const category = cleanText(body.category, "其他");
  const availableFrom = cleanText(body.availableFrom);
  const availableTo = cleanText(body.availableTo);
  const availabilityLabel = cleanText(body.availabilityLabel, "可预约");
  const returnRule = cleanText(body.returnRule, "归还时双方确认物品状态。");

  if (!title || !spot || !isCampus(body.campus) || !isAccessMode(body.accessMode)) {
    return NextResponse.json({ error: "缺少物品名称、使用方式、校区或交付地点" }, { status: 400 });
  }
  if (!validDateRange(availableFrom, availableTo)) {
    return NextResponse.json({ error: "请填写有效的可用日期范围" }, { status: 400 });
  }

  const accessMode = body.accessMode;
  const price = cleanMoney(body.price);
  const rentPrice = cleanMoney(body.rentPrice);
  const deposit = cleanMoney(body.deposit);

  const product = await addProduct({
    title,
    price,
    campus: body.campus,
    spot,
    distanceKm: 0,
    category,
    condition,
    emoji: "📦",
    tone: "mint",
    crossCampus: Boolean(body.crossCampus),
    accessMode,
    deposit,
    rentPrice: accessMode === "rent" ? rentPrice : undefined,
    availableFrom,
    availableTo,
    availabilityLabel,
    returnRequired: accessMode !== "buy",
    returnRule,
    agreement: ["借出前确认状态", "公共地点交付", "按约归还"],
  });
  return NextResponse.json(product, { status: 201 });
}
