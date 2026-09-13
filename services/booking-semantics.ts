import type { BookingType } from "@/models/planning";

type TransportBookingLike = {
  type: BookingType | string;
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  originLabel?: string | null;
  destinationLabel?: string | null;
};

/** A derived classification only; Booking remains the persisted truth. */
export function isTransportBooking(booking: TransportBookingLike) {
  if (booking.type === "flight" || booking.type === "train") return true;
  if (booking.type !== "other") return false;
  return Boolean(
    (booking.originPlaceId || booking.originLabel?.trim())
    && (booking.destinationPlaceId || booking.destinationLabel?.trim()),
  );
}

export function railwayDisplayLabel(title: string) {
  const service = title.match(/(?:^|\s|·)([GDC]\d{1,5})(?:\s|·|$)/i)?.[1]?.toUpperCase();
  if (service?.startsWith("G")) return "高铁";
  if (service?.startsWith("D")) return "动车";
  if (service?.startsWith("C")) return "城际";
  return "火车";
}

export function transportDisplayLabel(booking: TransportBookingLike & { title: string }) {
  if (booking.type === "flight") return "飞机";
  if (booking.type === "train") return railwayDisplayLabel(booking.title);
  return "客轮 / 班次交通";
}
