import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  addProduct,
  getProducts,
  updateProductStatus,
} from "../../../lib/data";
import { AccessMode, Campus, ProductStatus } from "../../../lib/types";

const campuses: Campus[] = ["SIP", "TAICANG"];
const accessModes: AccessMode[] = ["buy", "borrow", "rent", "swap"];
const productStatuses: ProductStatus[] = [
  "草稿",
  "审核中",
  "可用",
  "已预约",
  "使用中",
  "待归还",
  "已归还",
  "已下架",
  "审核拒绝",
];

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
  if (![from, to].every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))
    return false;
  const start = new Date(from);
  const end = new Date(to);
  return (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.toISOString().slice(0, 10) === from &&
    end.toISOString().slice(0, 10) === to &&
    start <= end &&
    to >= new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  );
}

function sortValue(item: Awaited<ReturnType<typeof getProducts>>[number]) {
  if (item.accessMode === "rent") return item.rentPrice ?? 0;
  if (item.accessMode === "buy") return item.price;
  return 0;
}

function recentValue(item: Awaited<ReturnType<typeof getProducts>>[number]) {
  if (item.createdAt) return Date.parse(item.createdAt) || 0;
  const legacyTimestamp = item.id.match(/^p(\d{13})/);
  if (legacyTimestamp) return Number(legacyTimestamp[1]);
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
  const admin = query.get("admin") === "1";
  if (!["near", "new", "high", "low"].includes(sort))
    return NextResponse.json({ error: "排序参数无效" }, { status: 400 });

  if (campus && !isCampus(campus))
    return NextResponse.json({ error: "校区参数无效" }, { status: 400 });
  if (scope !== "local" && scope !== "cross")
    return NextResponse.json({ error: "浏览范围参数无效" }, { status: 400 });
  if (accessMode && accessMode !== "all" && !isAccessMode(accessMode))
    return NextResponse.json({ error: "使用方式参数无效" }, { status: 400 });

  let products = await getProducts();
  if (!admin) {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    products = products.filter(
      (item) => item.status === "可用" && item.availableTo >= today,
    );
  }
  if (campus)
    products = products.filter((item) =>
      scope === "cross"
        ? item.campus !== campus && item.crossCampus
        : item.campus === campus,
    );
  if (category && category !== "全部")
    products = products.filter((item) => item.category === category);
  if (accessMode && accessMode !== "all")
    products = products.filter((item) => item.accessMode === accessMode);
  if (search)
    products = products.filter((item) =>
      `${item.title}${item.category}${item.spot}${item.condition}${item.availabilityLabel}`
        .toLowerCase()
        .includes(search),
    );
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
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid body");
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

  if (
    !title ||
    !spot ||
    !isCampus(body.campus) ||
    !isAccessMode(body.accessMode)
  ) {
    return NextResponse.json(
      { error: "缺少物品名称、使用方式、校区或交付地点" },
      { status: 400 },
    );
  }
  if (!validDateRange(availableFrom, availableTo)) {
    return NextResponse.json(
      { error: "请填写有效的可用日期范围" },
      { status: 400 },
    );
  }

  if (
    title.length > 100 ||
    spot.length > 120 ||
    condition.length > 500 ||
    returnRule.length > 2000 ||
    category.length > 50 ||
    availabilityLabel.length > 100
  )
    return NextResponse.json({ error: "输入内容过长" }, { status: 400 });
  if (
    [body.price, body.rentPrice, body.deposit].some(
      (value) =>
        value !== undefined &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100000),
    )
  )
    return NextResponse.json(
      { error: "金额必须是 0 至 100000 的数字" },
      { status: 400 },
    );
  const accessMode = body.accessMode;
  const price = cleanMoney(body.price);
  const rentPrice = cleanMoney(body.rentPrice);
  const deposit = cleanMoney(body.deposit);
  if (accessMode === "rent" && rentPrice <= 0)
    return NextResponse.json(
      { error: "请填写大于 0 的日租金" },
      { status: 400 },
    );

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
    agreement:
      accessMode === "buy"
        ? ["交付前确认状态", "公共地点交付", "确认买断价格"]
        : ["借出前确认状态", "公共地点交付", "按约归还"],
  });
  return NextResponse.json(product, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const id = cleanText(body.id);
  const status = cleanText(body.status) as ProductStatus;
  if (!id || !productStatuses.includes(status)) {
    return NextResponse.json(
      { error: "请提供有效的物品 ID 和状态" },
      { status: 400 },
    );
  }

  const product = await updateProductStatus(id, status);
  if (!product)
    return NextResponse.json({ error: "未找到物品" }, { status: 404 });
  return NextResponse.json(product);
}
