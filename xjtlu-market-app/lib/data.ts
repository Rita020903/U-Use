import { promises as fs } from "node:fs";
import path from "node:path";
import {
  Booking,
  BookingStatus,
  Product,
  ProductStatus,
  Report,
  ReportStatus,
} from "./types";
import { transitionsFor } from "./booking-state";

const dataDirectory =
  process.env.DATA_DIRECTORY || path.join(process.cwd(), "data");
const productsPath = path.join(dataDirectory, "products.json");
const bookingsPath = path.join(dataDirectory, "bookings.json");
const reportsPath = path.join(dataDirectory, "reports.json");
const DAY_MS = 24 * 60 * 60 * 1000;
let writeQueue = Promise.resolve();
let reportWriteQueue = Promise.resolve();

async function atomicWrite(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2));
    await fs.rename(temporary, filePath);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

export class BookingError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  return new Date(`${date}T00:00:00Z`);
}

/**
 * 课程原型用本地模拟数据，窗口写死在 JSON 里。
 * 如果某件物品的可用窗口已经全部过去（例如演示时间晚于数据里的日期），
 * 就把窗口按整周向前平移，保证演示时列表里始终有可借物品。
 * 真实运营版本不需要这段逻辑。
 */
export function refreshAvailability(product: Product): Product {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.DEMO_MODE !== "true"
  )
    return product;
  const from = new Date(`${product.availableFrom}T00:00:00Z`);
  const to = new Date(`${product.availableTo}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
    return product;

  const today = startOfToday();
  if (to.getTime() >= today.getTime()) return product;

  const spanDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / DAY_MS),
  );
  const weeksBehind = Math.ceil(
    (today.getTime() - to.getTime()) / (7 * DAY_MS),
  );
  const shift = weeksBehind * 7 * DAY_MS;
  const shiftedFrom = new Date(from.getTime() + shift);

  return {
    ...product,
    availableFrom: toISODate(shiftedFrom),
    availableTo: toISODate(new Date(shiftedFrom.getTime() + spanDays * DAY_MS)),
  };
}

export async function getProducts(): Promise<Product[]> {
  const products = await readJsonFile<Product[]>(productsPath, []);
  const bookings = await readJsonFile<Booking[]>(bookingsPath, []);
  const sold = new Set(
    bookings
      .filter(
        (item) => item.status === "已完成" && item.accessModeSnapshot === "buy",
      )
      .map((item) => item.productId),
  );
  return products.map((product) =>
    sold.has(product.id)
      ? { ...product, status: "已下架" as const }
      : refreshAvailability(product),
  );
}

export async function addProduct(input: Omit<Product, "id" | "status">) {
  const product: Product = {
    ...input,
    createdAt: new Date().toISOString(),
    id: `p${crypto.randomUUID()}`,
    status: "审核中",
  };

  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      const products = await getProducts();
      await atomicWrite(productsPath, [product, ...products]);
    });

  await writeQueue;
  return product;
}

export async function updateProductStatus(
  productId: string,
  status: ProductStatus,
) {
  let updated: Product | null = null;
  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      const products = await getProducts();
      const nextProducts = products.map((product) => {
        if (product.id !== productId) return product;
        updated = { ...product, status };
        return updated;
      });
      await atomicWrite(productsPath, nextProducts);
    });
  await writeQueue;
  return updated;
}

export async function getBookings(): Promise<Booking[]> {
  return readJsonFile<Booking[]>(bookingsPath, []);
}

export async function addBooking(
  input: Omit<Booking, "id" | "status" | "createdAt">,
) {
  const booking: Booking = {
    ...input,
    id: `b${crypto.randomUUID()}`,
    status: "待确认",
    createdAt: new Date().toISOString(),
  };

  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      const product = (await getProducts()).find(
        (item) => item.id === input.productId,
      );
      if (!product) throw new BookingError("物品不存在", 404);
      if (product.status !== "可用") throw new BookingError("该物品暂不可预约");
      if (input.campus !== product.campus && !product.crossCampus)
        throw new BookingError("该物品不支持跨校区交付", 400);
      booking.returnRequiredSnapshot = product.returnRequired !== false;
      booking.accessModeSnapshot = product.accessMode;
      const start = new Date(input.time).getTime();
      const end = new Date(input.returnTime).getTime();
      if (
        ![input.time, input.returnTime].every((value) =>
          /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value),
        )
      )
        throw new BookingError("预约时间必须包含时区", 400);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start <= Date.now() ||
        (booking.returnRequiredSnapshot ? end <= start : end < start)
      )
        throw new BookingError(
          "请选择有效的未来借出时间，归还时间须晚于借出时间",
          400,
        );
      const localDate = new Date(start + 8 * 3600000)
        .toISOString()
        .slice(0, 10);
      const endDate = new Date(end + 8 * 3600000).toISOString().slice(0, 10);
      if (localDate < product.availableFrom || endDate > product.availableTo)
        throw new BookingError("预约时间超出物品可用日期", 400);
      const bookings = await getBookings();
      if (
        bookings.some(
          (item) =>
            item.productId === input.productId &&
            !["已归还", "已取消", "已完成"].includes(item.status) &&
            (product.accessMode === "buy" ||
              !Number.isFinite(Date.parse(item.time)) ||
              (Date.parse(item.time) < end &&
                Date.parse(item.returnTime) > start)),
        )
      )
        throw new BookingError("该时段已有预约，请选择其他时间");
      await atomicWrite(bookingsPath, [booking, ...bookings]);
    });

  await writeQueue;
  return booking;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
) {
  let updated: Booking | null = null;
  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      const bookings = await getBookings();
      const nextBookings = bookings.map((booking) => {
        if (booking.id !== bookingId) return booking;
        if (!transitionsFor(booking).includes(status))
          throw new BookingError("当前状态不能执行此操作");
        updated = { ...booking, status };
        return updated;
      });
      await atomicWrite(bookingsPath, nextBookings);
    });
  await writeQueue;
  return updated;
}

export async function getReports(): Promise<Report[]> {
  return readJsonFile<Report[]>(reportsPath, []);
}

export async function addReport(
  input: Omit<Report, "id" | "status" | "createdAt">,
) {
  const report: Report = {
    ...input,
    id: `r${crypto.randomUUID()}`,
    status: "待处理",
    createdAt: new Date().toISOString(),
  };

  reportWriteQueue = reportWriteQueue
    .catch(() => {})
    .then(async () => {
      const reports = await getReports();
      await atomicWrite(reportsPath, [report, ...reports]);
    });

  await reportWriteQueue;
  return report;
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
) {
  let updated: Report | null = null;
  reportWriteQueue = reportWriteQueue
    .catch(() => {})
    .then(async () => {
      const reports = await getReports();
      const nextReports = reports.map((report) => {
        if (report.id !== reportId) return report;
        updated = { ...report, status };
        return updated;
      });
      await atomicWrite(reportsPath, nextReports);
    });
  await reportWriteQueue;
  return updated;
}
