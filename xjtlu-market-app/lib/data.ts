import { promises as fs } from "node:fs";
import path from "node:path";
import { Booking, BookingStatus, Product, ProductStatus, Report, ReportStatus } from "./types";

const productsPath = path.join(process.cwd(), "data", "products.json");
const bookingsPath = path.join(process.cwd(), "data", "bookings.json");
const reportsPath = path.join(process.cwd(), "data", "reports.json");
const DAY_MS = 24 * 60 * 60 * 1000;
let writeQueue = Promise.resolve();
let bookingWriteQueue = Promise.resolve();
let reportWriteQueue = Promise.resolve();

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
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 课程原型用本地模拟数据，窗口写死在 JSON 里。
 * 如果某件物品的可用窗口已经全部过去（例如演示时间晚于数据里的日期），
 * 就把窗口按整周向前平移，保证演示时列表里始终有可借物品。
 * 真实运营版本不需要这段逻辑。
 */
export function refreshAvailability(product: Product): Product {
  const from = new Date(`${product.availableFrom}T00:00:00`);
  const to = new Date(`${product.availableTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return product;

  const today = startOfToday();
  if (to.getTime() >= today.getTime()) return product;

  const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  const weeksBehind = Math.ceil((today.getTime() - to.getTime()) / (7 * DAY_MS));
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
  return products.map(refreshAvailability);
}

export async function addProduct(input: Omit<Product, "id" | "status">) {
  const product: Product = {
    ...input,
    id: `p${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    status: "审核中"
  };

  writeQueue = writeQueue.then(async () => {
    const products = await getProducts();
    await fs.writeFile(productsPath, JSON.stringify([product, ...products], null, 2));
  });

  await writeQueue;
  return product;
}

export async function updateProductStatus(productId: string, status: ProductStatus) {
  let updated: Product | null = null;
  writeQueue = writeQueue.then(async () => {
    const products = await getProducts();
    const nextProducts = products.map((product) => {
      if (product.id !== productId) return product;
      updated = { ...product, status };
      return updated;
    });
    await fs.writeFile(productsPath, JSON.stringify(nextProducts, null, 2));
  });
  await writeQueue;
  return updated;
}

export async function getBookings(): Promise<Booking[]> {
  return readJsonFile<Booking[]>(bookingsPath, []);
}

export async function addBooking(input: Omit<Booking, "id" | "status" | "createdAt">) {
  const booking: Booking = {
    ...input,
    id: `b${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    status: "待确认",
    createdAt: new Date().toISOString()
  };

  bookingWriteQueue = bookingWriteQueue.then(async () => {
    const bookings = await getBookings();
    await fs.writeFile(bookingsPath, JSON.stringify([booking, ...bookings], null, 2));
  });

  await bookingWriteQueue;
  return booking;
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  let updated: Booking | null = null;
  bookingWriteQueue = bookingWriteQueue.then(async () => {
    const bookings = await getBookings();
    const nextBookings = bookings.map((booking) => {
      if (booking.id !== bookingId) return booking;
      updated = { ...booking, status };
      return updated;
    });
    await fs.writeFile(bookingsPath, JSON.stringify(nextBookings, null, 2));
  });
  await bookingWriteQueue;
  return updated;
}

export async function getReports(): Promise<Report[]> {
  return readJsonFile<Report[]>(reportsPath, []);
}

export async function addReport(input: Omit<Report, "id" | "status" | "createdAt">) {
  const report: Report = {
    ...input,
    id: `r${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    status: "待处理",
    createdAt: new Date().toISOString()
  };

  reportWriteQueue = reportWriteQueue.then(async () => {
    const reports = await getReports();
    await fs.writeFile(reportsPath, JSON.stringify([report, ...reports], null, 2));
  });

  await reportWriteQueue;
  return report;
}

export async function updateReportStatus(reportId: string, status: ReportStatus) {
  let updated: Report | null = null;
  reportWriteQueue = reportWriteQueue.then(async () => {
    const reports = await getReports();
    const nextReports = reports.map((report) => {
      if (report.id !== reportId) return report;
      updated = { ...report, status };
      return updated;
    });
    await fs.writeFile(reportsPath, JSON.stringify(nextReports, null, 2));
  });
  await reportWriteQueue;
  return updated;
}
