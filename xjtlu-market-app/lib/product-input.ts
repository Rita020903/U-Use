import { Product, Person } from "./types";
import { ApiError, text } from "./http";
import { places, placeFor, distanceKm } from "./places";
import { database } from "./database";
export async function productInput(
  body: Record<string, unknown>,
  person: Person,
): Promise<Omit<Product, "id" | "status">> {
  const title = text(body.title),
    condition = text(body.condition),
    campus = body.campus,
    accessMode = body.accessMode,
    spot = text(body.spot),
    locationId = text(body.locationId),
    category = text(body.category),
    availableFrom = text(body.availableFrom),
    availableTo = text(body.availableTo),
    availabilityLabel = text(body.availabilityLabel),
    returnRule = text(body.returnRule),
    swapRule = text(body.swapRule);
  if (
    !title ||
    title.length > 100 ||
    !condition ||
    condition.length > 500 ||
    !spot ||
    spot.length > 120 ||
    !["SIP", "TAICANG"].includes(String(campus)) ||
    !["borrow", "rent", "buy", "swap"].includes(String(accessMode))
  )
    throw new ApiError("请完整填写名称、成色、校区、地点和使用方式");
  if (
    ![
      "学习考试",
      "活动服装",
      "出行用品",
      "交通",
      "数码产品",
      "活动设备",
    ].includes(category) ||
    availabilityLabel.length > 100 ||
    returnRule.length > 2000 ||
    swapRule.length > 500
  )
    throw new ApiError("分类或说明内容无效");
  for (const date of [availableFrom, availableTo]) {
    const parsed = new Date(date + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new ApiError("可用日期无效");
  }
  if (
    availableFrom > availableTo ||
    availableTo < new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  )
    throw new ApiError("可用结束日期不能早于开始日期或今天");
  const place = placeFor(locationId);
  if (locationId && (!place || place.campus !== campus || place.label !== spot))
    throw new ApiError("地点与校区不一致");
  for (const key of ["price", "rentPrice", "deposit"])
    if (
      body[key] !== undefined &&
      (typeof body[key] !== "number" ||
        !Number.isFinite(body[key]) ||
        Number(body[key]) < 0 ||
        Number(body[key]) > 100000 ||
        Math.abs(
          Math.round(Number(body[key]) * 100) - Number(body[key]) * 100,
        ) > 0.00001)
    )
      throw new ApiError("金额需为 0 至 100000 元，最多两位小数");
  const coords = body.handoffCoordinates as
      | { lat: number; lng: number }
      | undefined,
    center =
      campus === "SIP"
        ? { lat: 31.27558, lng: 120.73584 }
        : { lat: 31.48303, lng: 121.15569 };
  if (
    coords !== undefined &&
    (!coords ||
      typeof coords.lat !== "number" ||
      typeof coords.lng !== "number" ||
      !Number.isFinite(coords.lat) ||
      !Number.isFinite(coords.lng) ||
      distanceKm(center, coords) > 10)
  )
    throw new ApiError("地图标记需在校区周边 10 公里内；也可以不添加标记");
  const photos = body.photos;
  if (
    !Array.isArray(photos) ||
    photos.length < 1 ||
    photos.length > 5 ||
    photos.some(
      (p) => typeof p !== "string" || !/^\/api\/photos\/[a-f0-9-]{36}$/.test(p),
    )
  )
    throw new ApiError("请上传 1 至 5 张实物照片");
  await database(async (tx) => {
    for (const url of photos) {
      const photo = await tx.get<{ ownerId: string }>(
        "photos",
        url.split("/").pop()!,
      );
      if (photo?.ownerId !== person.id)
        throw new ApiError("照片不属于当前账号");
    }
  });
  const rentPrice = Number(body.rentPrice || 0),
    price = Number(body.price || 0),
    deposit = Number(body.deposit || 0);
  if (accessMode === "rent" && rentPrice <= 0)
    throw new ApiError("日租金需大于零");
  if (accessMode === "swap" && !swapRule)
    throw new ApiError("请填写希望换取的物品");
  const returnRequired = accessMode === "borrow" || accessMode === "rent";
  if (returnRequired && !returnRule) throw new ApiError("请填写归还规则");
  return {
    ownerId: person.id,
    title,
    condition,
    campus: campus as Product["campus"],
    spot,
    locationId: locationId || undefined,
    handoffCoordinates: coords,
    accessMode: accessMode as Product["accessMode"],
    category,
    availableFrom,
    availableTo,
    availabilityLabel: availabilityLabel || "可预约",
    returnRule: returnRequired
      ? returnRule
      : accessMode === "swap"
        ? "永久交换，交付后无需归还"
        : "买断后无需归还",
    returnRequired,
    price: accessMode === "buy" ? price : 0,
    deposit: returnRequired ? deposit : 0,
    rentPrice: accessMode === "rent" ? rentPrice : undefined,
    photos,
    swapRule: accessMode === "swap" ? swapRule : undefined,
    distanceKm: 0,
    emoji: "",
    tone: "mint",
    crossCampus: body.crossCampus === true,
    agreement: [
      "公共地点交付",
      "双方确认实物状态",
      returnRequired ? "按约归还" : "确认所有权转移",
    ],
  };
}
