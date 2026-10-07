import { randomUUID } from "node:crypto";
import { database, Transaction } from "./database";
import { createOnce } from "./submissions";
import { parseBookingTime } from "./booking-times";
import {
  Booking,
  BookingStatus,
  Product,
  ProductStatus,
  Report,
  ReportStatus,
  Person,
} from "./types";
import { transitionsFor } from "./booking-state";
import {
  activeBooking,
  occupiedProduct,
  meetingConflict,
  actionsFor,
  BookingAction,
} from "./booking-rules";
import { timetableConflict } from "./timetable";
import { placeFor } from "./places";
import { notify } from "./notifications";
import { availableInRange, DateRange } from "./availability";
export class BookingError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
// Availability dates are never moved, including during development.
export function refreshAvailability(product: Product) {
  return product;
}
async function expire(tx: Transaction) {
  const bookings = await tx.list<Booking>("bookings");
  for (const b of bookings)
    if (b.status === "待确认" && b.expiresAt && b.expiresAt <= Date.now()) {
      b.status = "已取消";
      await tx.put("bookings", b.id, b);
      await notify(tx, b.requesterId, "预约超时未确认，已自动取消", b.id);
    }
  return bookings;
}
async function productsIn(tx: Transaction) {
  const items = await tx.list<Product>("products"),
    bookings = await tx.list<Booking>("bookings");
  const sold = new Set(
    bookings
      .filter(
        (b) => b.status === "已完成" && b.returnRequiredSnapshot === false,
      )
      .flatMap((b) => [b.productId, b.offeredProductId]),
  );
  return items.map((p) =>
    sold.has(p.id) ? { ...p, status: "已下架" as const } : p,
  );
}
export async function getProducts(range?: DateRange) {
  return database(async (tx) => {
    const products = await productsIn(tx);
    if (!range) return products;
    const bookings = await tx.list<Booking>("bookings");
    return products.filter((p) => availableInRange(p, bookings, range));
  });
}
export async function addProduct(
  input: Omit<Product, "id" | "status">,
  requestId?: unknown,
) {
  const product: Product = {
    ...input,
    id: "p" + randomUUID(),
    createdAt: new Date().toISOString(),
    status: "审核中",
    isDemo: false,
  };
  return database((tx) =>
    createOnce(
      tx,
      "products",
      input.ownerId || "",
      requestId,
      input,
      async () => {
        await tx.put("products", product.id, product);
        return product;
      },
    ),
  );
}
export async function updateProductStatus(id: string, status: ProductStatus) {
  return database(async (tx) => {
    const item = await tx.get<Product>("products", id);
    if (!item) return null;
    const updated = { ...item, status };
    await tx.put("products", id, updated);
    await notify(
      tx,
      item.ownerId,
      "你的物品「" + item.title + "」状态已更新为：" + status,
    );
    return updated;
  });
}
export async function editProduct(
  id: string,
  ownerId: string,
  changes: Partial<Product>,
) {
  return database(async (tx) => {
    const item = await tx.get<Product>("products", id);
    if (!item) throw new BookingError("物品不存在", 404);
    if (item.ownerId !== ownerId)
      throw new BookingError("只能管理自己发布的物品", 403);
    const bookings = await expire(tx);
    if (
      bookings.some(
        (b) =>
          activeBooking(b) && [b.productId, b.offeredProductId].includes(id),
      )
    )
      throw new BookingError("存在进行中的预约，请先完成或取消交易");
    const updated = {
      ...item,
      ...changes,
      id: item.id,
      ownerId: item.ownerId,
      isDemo: item.isDemo,
      status:
        changes.status === "已下架" ? ("已下架" as const) : ("审核中" as const),
    };
    await tx.put("products", id, updated);
    return updated;
  });
}
export async function getBookings(personId?: string, admin = false) {
  return database(async (tx) => {
    const bookings = await expire(tx);
    return bookings
      .filter(
        (b) =>
          admin ||
          (!!personId && [b.ownerId, b.requesterId].includes(personId)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

async function checkSchedule(
  tx: Transaction,
  product: Product,
  input: Pick<
    Booking,
    "time" | "returnTime" | "campus" | "locationId" | "requesterId"
  >,
  bookings: Booking[],
  ignore?: string,
) {
  const place = placeFor(input.locationId),
    ids = [input.requesterId || "", product.ownerId || ""];
  for (const instant of [
    input.time,
    ...(product.returnRequired ? [input.returnTime] : []),
  ]) {
    if (meetingConflict(bookings, ids, instant, input.campus, ignore))
      throw new BookingError(
        "双方已有其他交付或归还安排，请选择其他时间（含通行缓冲）",
      );
    for (const id of ids) {
      const person = id ? await tx.get<Person>("people", id) : undefined;
      if (
        person?.timetable &&
        timetableConflict(
          person.timetable,
          instant,
          15,
          input.campus,
          place?.building,
        )
      )
        throw new BookingError("交付或归还时间与双方课表冲突（含通行缓冲）");
    }
  }
}
function validateTimes(
  product: Product,
  input: Pick<Booking, "time" | "returnTime" | "campus">,
) {
  if (input.campus !== product.campus && !product.crossCampus)
    throw new BookingError("该物品不支持跨校区交付", 400);
  const start = parseBookingTime(input.time),
    end = parseBookingTime(input.returnTime);
  if (
    ![input.time, input.returnTime].every((t) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        t,
      ),
    )
  )
    throw new BookingError("预约时间必须包含时区", 400);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start <= Date.now() ||
    (product.returnRequired ? end <= start : end < start)
  )
    throw new BookingError("请选择未来交付时间，归还时间须晚于交付时间", 400);
  const from = new Date(start + 8 * 3600000).toISOString().slice(0, 10),
    to = new Date(end + 8 * 3600000).toISOString().slice(0, 10);
  if (from < product.availableFrom || to > product.availableTo)
    throw new BookingError("预约时间超出物品可用日期", 400);
  return { start, end };
}
export async function addBooking(
  input: Omit<Booking, "id" | "status" | "createdAt"> & {
    expectedFee?: number;
    expectedDeposit?: number;
    expectedMode?: string;
  },
  requestId?: unknown,
) {
  return database(async (tx) => {
    const bookings = await expire(tx);
    return createOnce(
      tx,
      "bookings",
      input.requesterId || "",
      requestId,
      {
        productId: input.productId,
        campus: input.campus,
        spot: input.spot,
        locationId: input.locationId || "",
        time: input.time,
        returnTime: input.returnTime,
        note: input.note,
        offeredProductId: input.offeredProductId || "",
        expectedFee: input.expectedFee,
        expectedDeposit: input.expectedDeposit,
        expectedMode: input.expectedMode,
      },
      async () => {
        const product = (await productsIn(tx)).find(
          (p) => p.id === input.productId,
        );
        if (!product) throw new BookingError("物品不存在", 404);
        if (product.status !== "可用")
          throw new BookingError("该物品暂不可预约");
        if (!input.requesterId || !product.ownerId)
          throw new BookingError(
            "示例物品无法真实预约；请登录后发布自己的物品",
            400,
          );
        if (input.requesterId === product.ownerId)
          throw new BookingError("不能预约自己发布的物品");
        const requester = await tx.get<Person>("people", input.requesterId),
          owner = await tx.get<Person>("people", product.ownerId);
        if (!requester?.verified || !owner?.verified)
          throw new BookingError("交易双方需要先验证学生邮箱", 403);
        if (
          process.env.NODE_ENV === "production" &&
          (requester.verificationMode !== "email" ||
            owner.verificationMode !== "email")
        )
          throw new BookingError("本地开发账号不能参与正式交易", 403);
        const { start, end } = validateTimes(product, input);
        if (
          bookings.some((b) =>
            occupiedProduct(b, product.id, start, end, !product.returnRequired),
          )
        )
          throw new BookingError(
            "该时段已有预约或物品尚未归还，请选择其他时间",
          );
        await checkSchedule(tx, product, input, bookings);
        let offered: Product | undefined;
        if (product.accessMode === "swap") {
          offered = await tx.get<Product>(
            "products",
            input.offeredProductId || "",
          );
          if (
            !offered ||
            offered.ownerId !== requester.id ||
            offered.status !== "可用" ||
            offered.accessMode !== "swap"
          )
            throw new BookingError("请选择自己已通过审核的交换物品", 400);
          validateTimes(offered, input);
          if (
            bookings.some((b) =>
              occupiedProduct(
                b,
                offered!.id,
                start,
                end,
                !product.returnRequired,
              ),
            )
          )
            throw new BookingError("用于交换的物品已有预约");
        }
        const rentalDays =
          product.accessMode === "rent"
            ? Math.max(1, Math.ceil((end - start) / 86400000))
            : 0;
        const fee =
          product.accessMode === "buy"
            ? product.price
            : product.accessMode === "rent"
              ? Math.round(rentalDays * (product.rentPrice || 0) * 100) / 100
              : 0;
        if (
          (input.expectedFee !== undefined && input.expectedFee !== fee) ||
          (input.expectedDeposit !== undefined &&
            input.expectedDeposit !== product.deposit) ||
          (input.expectedMode !== undefined &&
            input.expectedMode !== product.accessMode)
        )
          throw new BookingError("物品费用或交易方式已更新，请刷新后重新确认");
        const {
          expectedFee,
          expectedDeposit,
          expectedMode,
          offeredProductId,
          ...details
        } = input;
        const booking: Booking = {
          ...details,
          id: "b" + randomUUID(),
          status: "待确认",
          createdAt: new Date().toISOString(),
          ownerId: owner.id,
          requester: requester.name || "学生",
          owner: owner.name || "学生",
          productTitle: product.title,
          depositSnapshot: product.deposit,
          priceSnapshot: product.price,
          rentPriceSnapshot: product.rentPrice,
          feeSnapshot: fee,
          rentalDays,
          returnRequiredSnapshot: product.returnRequired,
          accessModeSnapshot: product.accessMode,
          offeredProductId: offered?.id,
          offeredProductTitle: offered?.title,
          expiresAt: Math.min(Date.now() + 24 * 3600000, start),
        };
        await tx.put("bookings", booking.id, booking);
        await notify(
          tx,
          owner.id,
          "「" + product.title + "」收到新预约，请确认时间、地点和费用",
          booking.id,
        );
        return booking;
      },
    );
  });
}
export async function actOnBooking(
  id: string,
  personId: string,
  action: BookingAction,
  reason = "",
) {
  return database(async (tx) => {
    const bookings = await expire(tx),
      booking = bookings.find((b) => b.id === id);
    if (!booking) throw new BookingError("预约不存在", 404);
    if (![booking.ownerId, booking.requesterId].includes(personId))
      throw new BookingError("无权操作该预约", 403);
    if (!actionsFor(booking, personId).includes(action))
      throw new BookingError("当前状态不能执行此操作");
    const updated = { ...booking };
    if (action === "accept") {
      const product = await tx.get<Product>("products", booking.productId);
      if (!product) throw new BookingError("物品不存在", 404);
      validateTimes(product, booking);
      await checkSchedule(tx, product, booking, bookings, id);
      updated.status = "已确认";
      delete updated.expiresAt;
    }
    if (action === "reject" || action === "cancel") updated.status = "已取消";
    if (action === "handoff") {
      if (Date.parse(booking.time) > Date.now() + 30 * 60000)
        throw new BookingError(
          "交付时间尚未到达，请在约定时间前 30 分钟内确认",
        );
      updated.handoffConfirmedBy = [
        ...new Set([...(booking.handoffConfirmedBy || []), personId]),
      ];
      if (updated.handoffConfirmedBy.length === 2) {
        updated.status =
          booking.returnRequiredSnapshot === false ? "已完成" : "使用中";
        if (updated.status === "已完成") {
          updated.closedAt = new Date().toISOString();
          for (const productId of [booking.productId, booking.offeredProductId])
            if (productId) {
              const p = await tx.get<Product>("products", productId);
              if (p) await tx.put("products", p.id, { ...p, status: "已下架" });
            }
        }
      }
    }
    if (action === "return") {
      updated.returnConfirmedBy = [
        ...new Set([...(booking.returnConfirmedBy || []), personId]),
      ];
      updated.status =
        updated.returnConfirmedBy.length === 2 ? "已归还" : "待归还";
      if (updated.status === "已归还")
        updated.closedAt = new Date().toISOString();
    }
    if (action === "payment")
      updated.paymentConfirmedBy = [
        ...new Set([...(booking.paymentConfirmedBy || []), personId]),
      ];
    if (action === "dispute") {
      if (reason.trim().length < 5 || reason.length > 1000)
        throw new BookingError("请填写至少 5 字的争议说明", 400);
      updated.status = "有争议";
      updated.disputeReason = reason.trim();
      const reportId = "r" + randomUUID();
      await tx.put("reports", reportId, {
        id: reportId,
        target: id,
        reason: "交易争议",
        note: reason.trim(),
        reporterId: personId,
        status: "待处理",
        createdAt: new Date().toISOString(),
      });
    }
    await tx.put("bookings", id, updated);
    for (const other of [booking.ownerId, booking.requesterId])
      if (other !== personId)
        await notify(
          tx,
          other,
          "「" +
            booking.productTitle +
            "」交易已更新：" +
            {
              accept: "预约已确认",
              reject: "预约被拒绝",
              cancel: "预约已取消",
              handoff: "对方已确认交付",
              return: "对方已确认归还",
              payment: "对方已确认线下收付款",
              dispute: "对方发起争议",
            }[action],
          id,
        );
    return updated;
  });
}
export async function updateBookingStatus(id: string, status: BookingStatus) {
  return database(async (tx) => {
    const b = await tx.get<Booking>("bookings", id);
    if (!b) return null;
    if (b.ownerId && b.status !== "有争议")
      throw new BookingError("真实交易由双方确认；管理员只能仲裁争议");
    if (!transitionsFor(b).includes(status))
      throw new BookingError("当前状态不能执行此操作");
    const next = {
      ...b,
      status,
      ...(["已完成", "已归还", "已取消"].includes(status)
        ? { closedAt: new Date().toISOString() }
        : {}),
    };
    if (
      status === "已完成" ||
      (status === "已取消" && b.handoffConfirmedBy?.length)
    )
      for (const productId of [b.productId, b.offeredProductId])
        if (productId) {
          const p = await tx.get<Product>("products", productId);
          if (p) await tx.put("products", p.id, { ...p, status: "已下架" });
        }
    await tx.put("bookings", id, next);
    await notify(tx, b.requesterId, "管理员仲裁交易状态：" + status, id);
    await notify(tx, b.ownerId, "管理员仲裁交易状态：" + status, id);
    const auditId = randomUUID();
    await tx.put("audit", auditId, {
      id: auditId,
      bookingId: id,
      from: b.status,
      to: status,
      at: new Date().toISOString(),
      actor: "admin",
    });
    return next;
  });
}
export async function getReports() {
  return database((tx) => tx.list<Report>("reports"));
}
export async function addReport(
  input: Omit<Report, "id" | "status" | "createdAt">,
) {
  const report: Report = {
    ...input,
    id: "r" + randomUUID(),
    status: "待处理",
    createdAt: new Date().toISOString(),
  };
  await database((tx) => tx.put("reports", report.id, report));
  return report;
}
export async function updateReportStatus(id: string, status: ReportStatus) {
  return database(async (tx) => {
    const report = await tx.get<Report>("reports", id);
    if (!report) return null;
    const next = { ...report, status };
    await tx.put("reports", id, next);
    await notify(tx, report.reporterId, "你的举报处理状态：" + status);
    return next;
  });
}
