import { NextResponse } from "next/server";
import {
  addProduct,
  getProducts,
  updateProductStatus,
  editProduct,
} from "../../../lib/data";
import { ProductStatus } from "../../../lib/types";
import { requirePerson } from "../../../lib/people";
import { api, ApiError, jsonBody, isAdmin, text } from "../../../lib/http";
import { productInput } from "../../../lib/product-input";
import { rateLimit } from "../../../lib/database";
import { dateRange } from "../../../lib/availability";
import { needProducts } from "../../../lib/needs";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const q = request.nextUrl.searchParams,
    campus = q.get("campus"),
    scope = q.get("scope") || "local",
    sort = q.get("sort") || "new",
    mode = q.get("accessMode"),
    owner = q.get("owner"),
    mine = q.get("mine") === "1",
    admin = q.get("admin") === "1" && isAdmin(request);
  if (
    (campus && !["SIP", "TAICANG"].includes(campus)) ||
    !["local", "cross"].includes(scope) ||
    !["near", "new", "low", "high"].includes(sort) ||
    (mode && !["all", "buy", "borrow", "rent", "swap"].includes(mode))
  )
    throw new ApiError("筛选参数无效");
  if (owner && !/^[a-f0-9-]{36}$/.test(owner))
    throw new ApiError("用户参数无效");
  const range = dateRange(q.get("from") || "", q.get("to") || "");
  const needId = q.get("needId");
  if (needId && !mine)
    throw new ApiError("推荐物品必须从自己的物品中选择", 403);
  let products = needId
    ? await needProducts(needId, await requirePerson(request))
    : await getProducts(range);
  if (mine) {
    const person = await requirePerson(request);
    products = products.filter((p) => p.ownerId === person.id);
  } else if (!admin)
    products = products.filter(
      (p) =>
        p.status === "可用" &&
        p.availableTo >=
          new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    );
  if (campus)
    products = products.filter((p) =>
      scope === "cross"
        ? p.campus !== campus && p.crossCampus
        : p.campus === campus,
    );
  if (mode && mode !== "all")
    products = products.filter((p) => p.accessMode === mode);
  if (owner) products = products.filter((p) => p.ownerId === owner);
  const category = q.get("category"),
    search = (q.get("search") || "").toLowerCase();
  if (category && category !== "全部")
    products = products.filter((p) => p.category === category);
  if (search)
    products = products.filter((p) =>
      (p.title + p.condition + p.spot + p.category)
        .toLowerCase()
        .includes(search),
    );
  const ids = q.get("ids");
  if (ids) {
    const selected = ids.split(",");
    if (selected.length > 200 || selected.some((id) => id.length > 100))
      throw new ApiError("收藏筛选参数无效");
    products = products.filter((p) => selected.includes(p.id));
  }
  const cost = (p: (typeof products)[number]) =>
    p.accessMode === "rent"
      ? p.rentPrice || 0
      : p.accessMode === "buy"
        ? p.price
        : 0;
  products.sort((a, b) =>
    sort === "low"
      ? cost(a) - cost(b)
      : sort === "high"
        ? cost(b) - cost(a)
        : (Date.parse(b.createdAt || "") || 0) -
          (Date.parse(a.createdAt || "") || 0),
  );
  const total = products.length,
    offset = Number(q.get("offset") || 0),
    limit = Number(q.get("limit") || (admin || mine ? Math.max(1, total) : 50));
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1000000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    (q.has("limit") && limit > 100)
  )
    throw new ApiError("分页参数无效");
  return NextResponse.json(products.slice(offset, offset + limit), {
    headers: {
      "Cache-Control": "no-store",
      "X-Total-Count": String(total),
      "X-Has-More": String(offset + limit < total),
    },
  });
});
export const POST = api(async (request) => {
  const person = await requirePerson(request);
  if (!(await rateLimit("publish:" + person.id, 15, 3600000)))
    throw new ApiError("发布过于频繁，请稍后重试", 429);
  const body = await jsonBody(request);
  const product = await addProduct(
    await productInput(body, person),
    body.requestId,
  );
  return NextResponse.json(product, { status: 201 });
});
export const PATCH = api(async (request) => {
  const body = await jsonBody(request),
    id = text(body.id);
  if (!id) throw new ApiError("缺少物品 ID");
  if (body.action === "edit") {
    const person = await requirePerson(request);
    return NextResponse.json(
      await editProduct(id, person.id, await productInput(body, person)),
    );
  }
  if (body.action === "withdraw") {
    const person = await requirePerson(request);
    return NextResponse.json(
      await editProduct(id, person.id, { status: "已下架" }),
    );
  }
  if (!isAdmin(request)) throw new ApiError("只有管理员能修改审核状态", 403);
  const allowed: ProductStatus[] = ["审核中", "可用", "已下架", "审核拒绝"];
  if (!allowed.includes(body.status as ProductStatus))
    throw new ApiError("审核状态无效");
  const product = await updateProductStatus(id, body.status as ProductStatus);
  if (!product) throw new ApiError("物品不存在", 404);
  return NextResponse.json(product);
});
