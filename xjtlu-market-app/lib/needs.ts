import { randomUUID } from "node:crypto";
import { database } from "./database";
import { ApiError, text } from "./http";
import { Campus, Person, Product } from "./types";
import { availableInRange, dateRange, localToday } from "./availability";
import { notify } from "./notifications";
import { Booking } from "./types";
import { createOnce } from "./submissions";

export type Need = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  note: string;
  campus: Campus;
  accessMode: "borrow" | "rent" | "buy";
  from: string;
  to: string;
  budget?: number;
  status: "open" | "resolved" | "withdrawn";
  createdAt: string;
};
type Offer = {
  id: string;
  needId: string;
  personId: string;
  productId: string;
  createdAt: string;
};
export type NeedView = Omit<Need, "ownerId" | "status"> & {
  isMine: boolean;
  status: Need["status"] | "expired";
  offers: {
    id: string;
    productId: string;
    title: string;
    available: boolean;
  }[];
};
function verified(person: Person) {
  if (
    !person.verified ||
    (process.env.NODE_ENV === "production" &&
      person.verificationMode !== "email")
  )
    throw new ApiError("请先用西浦邮箱登录", 401);
}
export function availableForNeed(p: Product, n: Need, bookings: Booking[]) {
  const from = [
    n.from,
    localToday(),
    ...(n.accessMode === "buy" ? [p.availableFrom] : []),
  ]
    .sort()
    .at(-1)!;
  const cost = p.accessMode === "rent" ? p.rentPrice || 0 : p.price;
  return (
    n.status === "open" &&
    from <= n.to &&
    !p.isDemo &&
    p.accessMode === n.accessMode &&
    (p.campus === n.campus || p.crossCampus) &&
    (n.budget === undefined || cost <= n.budget) &&
    availableInRange(p, bookings, {
      from,
      to: n.accessMode === "buy" ? from : n.to,
    })
  );
}
export async function needProducts(id: string, person: Person) {
  verified(person);
  return database(async (tx) => {
    const n = await tx.get<Need>("needs", id);
    if (!n || n.status !== "open" || n.to < localToday())
      throw new ApiError("求物已结束或过期", 409);
    const bookings = await tx.list<Booking>("bookings");
    return (await tx.list<Product>("products")).filter(
      (p) => p.ownerId === person.id && availableForNeed(p, n, bookings),
    );
  });
}
export async function createNeed(
  body: Record<string, unknown>,
  person: Person,
) {
  verified(person);
  const title = text(body.title),
    note = text(body.note),
    range = dateRange(text(body.from), text(body.to)),
    campus = body.campus,
    accessMode = body.accessMode;
  if (
    !title ||
    title.length > 100 ||
    note.length > 500 ||
    !range ||
    !["SIP", "TAICANG"].includes(String(campus)) ||
    !["borrow", "rent", "buy"].includes(String(accessMode))
  )
    throw new ApiError("请填写有效的物品名称、校区、使用方式和日期");
  if (Date.parse(range.to) - Date.parse(range.from) > 90 * 86400000)
    throw new ApiError("求物日期跨度最多 90 天");
  const budget =
    accessMode === "borrow" || body.budget === undefined
      ? undefined
      : body.budget;
  if (
    budget !== undefined &&
    (typeof budget !== "number" ||
      !Number.isFinite(budget) ||
      budget < 0 ||
      budget > 100000 ||
      Math.abs(Math.round(budget * 100) - budget * 100) > 0.00001)
  )
    throw new ApiError("预算需为 0 至 100000 元，最多两位小数");
  const need: Need = {
    id: randomUUID(),
    ownerId: person.id,
    ownerName: person.name || "西浦同学",
    title,
    note,
    campus: campus as Campus,
    accessMode: accessMode as Need["accessMode"],
    ...range,
    budget: budget as number | undefined,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  return database(async (tx) =>
    createOnce(
      tx,
      "needs",
      person.id,
      body.requestId,
      { title, note, campus, accessMode, ...range, budget },
      async () => {
        const active = (await tx.list<Need>("needs")).filter(
          (n) =>
            n.ownerId === person.id &&
            n.status === "open" &&
            n.to >= localToday(),
        );
        if (active.length >= 10)
          throw new ApiError(
            "最多同时保留 10 条有效求物，请先结束已有需求",
            409,
          );
        await tx.put("needs", need.id, need);
        return need;
      },
    ),
  ).then((n) => ({ id: n.id }));
}
export async function listNeeds(
  campus: Campus,
  personId?: string,
  mine = false,
  offset = 0,
) {
  return database(async (tx) => {
    const all = (await tx.list<Need>("needs"))
      .filter((n) =>
        mine
          ? n.ownerId === personId
          : n.campus === campus && n.status === "open" && n.to >= localToday(),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const offers = await tx.list<Offer>("need-offers"),
      products = await tx.list<Product>("products"),
      bookings = await tx.list<Booking>("bookings");
    const items: NeedView[] = all.slice(offset, offset + 24).map((n) => {
      const { ownerId, ...publicNeed } = n;
      return {
        ...publicNeed,
        isMine: ownerId === personId,
        status:
          n.status === "open" && n.to < localToday() ? "expired" : n.status,
        offers: offers
          .filter(
            (o) =>
              o.needId === n.id &&
              !!personId &&
              (ownerId === personId || o.personId === personId),
          )
          .map((o) => {
            const p = products.find((item) => item.id === o.productId);
            return {
              id: o.id,
              productId: o.productId,
              title: p?.title || "物品已不可用",
              available: !!p && availableForNeed(p, n, bookings),
            };
          }),
      };
    });
    return { items, hasMore: offset + 24 < all.length };
  });
}
export async function finishNeed(
  id: string,
  person: Person,
  status: "resolved" | "withdrawn",
) {
  verified(person);
  return database(async (tx) => {
    const n = await tx.get<Need>("needs", id);
    if (!n) throw new ApiError("求物不存在", 404);
    if (n.ownerId !== person.id) throw new ApiError("只能管理自己的求物", 403);
    if (n.status === status) return { ok: true };
    if (n.status !== "open") throw new ApiError("求物已结束", 409);
    await tx.put("needs", id, { ...n, status });
    return { ok: true };
  });
}
export async function reviewNeed(id: string) {
  return database(async (tx) => {
    const n = await tx.get<Need>("needs", id);
    if (!n) throw new ApiError("求物不存在", 404);
    const { ownerId: _, ...details } = n;
    return details;
  });
}
export async function hideNeed(id: string) {
  return database(async (tx) => {
    const n = await tx.get<Need>("needs", id);
    if (!n) throw new ApiError("求物不存在", 404);
    if (n.status === "withdrawn") return { ok: true };
    await tx.put("needs", id, { ...n, status: "withdrawn" });
    const auditId = randomUUID();
    await tx.put("audit", auditId, {
      id: auditId,
      actor: "admin",
      action: "hide-need",
      target: id,
      createdAt: new Date().toISOString(),
    });
    await notify(
      tx,
      n.ownerId,
      "你的求物「" + n.title + "」已由管理员隐藏，请检查公开内容",
      undefined,
      id,
    );
    return { ok: true };
  });
}
export async function offerProduct(
  needId: string,
  productId: string,
  person: Person,
) {
  verified(person);
  return database(async (tx) => {
    const n = await tx.get<Need>("needs", needId),
      p = await tx.get<Product>("products", productId);
    if (!n) throw new ApiError("求物不存在", 404);
    if (n.status !== "open" || n.to < localToday())
      throw new ApiError("求物已结束或过期", 409);
    if (n.ownerId === person.id) throw new ApiError("不能回应自己的求物");
    if (!p || p.ownerId !== person.id || p.isDemo || p.status !== "可用")
      throw new ApiError("只能推荐自己已通过审核的物品", 403);
    if (
      p.accessMode !== n.accessMode ||
      (p.campus !== n.campus && !p.crossCampus)
    )
      throw new ApiError("物品的使用方式或交付校区不符合需求");
    const cost = p.accessMode === "rent" ? p.rentPrice || 0 : p.price;
    if (n.budget !== undefined && cost > n.budget)
      throw new ApiError("物品费用超出求物预算");
    if (!availableForNeed(p, n, await tx.list<Booking>("bookings")))
      throw new ApiError("物品在需求日期内不可用或已被预约", 409);
    const id = needId + ":" + productId;
    if (await tx.get<Offer>("need-offers", id))
      throw new ApiError("已经推荐过这件物品", 409);
    const existing = (await tx.list<Offer>("need-offers")).filter(
      (o) => o.needId === needId && o.personId === person.id,
    );
    if (existing.length >= 5)
      throw new ApiError("每条求物最多推荐 5 件物品", 409);
    await tx.put("need-offers", id, {
      id,
      needId,
      productId,
      personId: person.id,
      createdAt: new Date().toISOString(),
    });
    await notify(
      tx,
      n.ownerId,
      "你的求物「" + n.title + "」收到物品推荐",
      undefined,
      n.id,
    );
    return { ok: true };
  });
}
