import { Booking, BookingStatus } from "./types";

export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  待确认: ["已确认", "已取消"],
  已确认: ["已交付", "已取消"],
  已交付: ["使用中", "有争议"],
  使用中: ["待归还", "有争议"],
  待归还: ["已归还", "有争议"],
  有争议: ["待归还", "已取消"],
  已归还: [],
  已取消: [],
  已完成: [],
};

export function transitionsFor(booking: Booking): BookingStatus[] {
  if (booking.returnRequiredSnapshot === false && booking.status === "已交付")
    return ["已完成", "有争议"];
  if (booking.returnRequiredSnapshot === false && booking.status === "有争议")
    return ["已完成", "已取消"];
  return bookingTransitions[booking.status];
}
