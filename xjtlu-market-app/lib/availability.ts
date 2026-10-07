import { Booking, Product } from "./types";
import { occupiedProduct } from "./booking-rules";
import { ApiError } from "./http";

export type DateRange = { from: string; to: string };
export const localToday = (now = Date.now()) =>
  new Date(now + 8 * 3600000).toISOString().slice(0, 10);
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function dateRange(from: string, to: string): DateRange | undefined {
  if (!from && !to) return;
  const start = from || to,
    end = to || from;
  if (
    !validDate(start) ||
    !validDate(end) ||
    start > end ||
    start < localToday()
  )
    throw new ApiError("请选择今天起有效的使用日期，结束不能早于开始");
  return { from: start, to: end };
}
export function availableInRange(
  product: Product,
  bookings: Booking[],
  range: DateRange,
) {
  const endDate = product.returnRequired ? range.to : range.from;
  if (
    product.status !== "可用" ||
    product.availableFrom > range.from ||
    product.availableTo < endDate
  )
    return false;
  const start = Date.parse(range.from + "T00:00:00+08:00"),
    end = Date.parse(endDate + "T23:59:59.999+08:00");
  return !bookings.some((b) =>
    occupiedProduct(b, product.id, start, end, !product.returnRequired),
  );
}
