import { Booking } from "./types";
export function activeBooking(booking: Booking, now = Date.now()) {
  return (
    !["已取消", "已归还", "已完成"].includes(booking.status) &&
    !(
      booking.status === "待确认" &&
      booking.expiresAt &&
      booking.expiresAt <= now
    )
  );
}
export function occupiedProduct(
  booking: Booking,
  productId: string,
  start: number,
  end: number,
  permanent: boolean,
  now = Date.now(),
) {
  if (
    !activeBooking(booking, now) ||
    ![booking.productId, booking.offeredProductId].includes(productId)
  )
    return false;
  if (
    permanent ||
    booking.accessModeSnapshot === "buy" ||
    (booking.accessModeSnapshot === "swap" &&
      booking.returnRequiredSnapshot === false)
  )
    return true;
  if (
    ["使用中", "已交付", "待归还", "有争议"].includes(booking.status) &&
    Date.parse(booking.returnTime) < now
  )
    return true;
  return (
    Date.parse(booking.time) < end && Date.parse(booking.returnTime) > start
  );
}
export function meetingConflict(
  bookings: Booking[],
  ids: string[],
  instant: string,
  campus: string,
  ignoreId?: string,
) {
  const start = Date.parse(instant);
  return bookings.some((b) => {
    if (
      b.id === ignoreId ||
      !activeBooking(b) ||
      !ids.some((id) => id && [b.ownerId, b.requesterId].includes(id))
    )
      return false;
    const buffer = (b.campus === campus ? 25 : 90) * 60000;
    const meetings = [
      b.time,
      ...(b.returnRequiredSnapshot !== false ? [b.returnTime] : []),
    ];
    return meetings.some(
      (time) => Math.abs(Date.parse(time) - start) < buffer + 15 * 60000,
    );
  });
}
export type BookingAction =
  | "accept"
  | "reject"
  | "cancel"
  | "handoff"
  | "return"
  | "dispute"
  | "payment";
export function actionsFor(b: Booking, personId: string): BookingAction[] {
  if (![b.ownerId, b.requesterId].includes(personId)) return [];
  if (
    ["已完成", "已归还"].includes(b.status) &&
    Date.parse(b.closedAt || b.returnTime) > Date.now() - 7 * 86400000
  )
    return ["dispute"];
  if (!activeBooking(b)) return [];
  const actions: BookingAction[] = [];
  if (b.status === "待确认" && b.ownerId === personId)
    actions.push("accept", "reject");
  if (["待确认", "已确认"].includes(b.status) && !b.handoffConfirmedBy?.length)
    actions.push("cancel");
  if (b.status === "已确认" && !b.handoffConfirmedBy?.includes(personId))
    actions.push("handoff");
  if (
    ["使用中", "已交付", "待归还"].includes(b.status) &&
    b.returnRequiredSnapshot !== false &&
    !b.returnConfirmedBy?.includes(personId)
  )
    actions.push("return");
  if (["已确认", "使用中", "已交付", "待归还"].includes(b.status))
    actions.push("dispute");
  if (
    (b.feeSnapshot || b.depositSnapshot) > 0 &&
    b.status !== "有争议" &&
    !b.paymentConfirmedBy?.includes(personId)
  )
    actions.push("payment");
  return actions;
}
