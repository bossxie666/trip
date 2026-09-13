type HotelBooking = {
  id: string;
  status: string;
  totalAmountMinor: number | null;
  currency: string | null;
};

type CostLine = { bookingId: string; amountMinor: number; currency: string };

export function summarizeAccommodation(bookings: HotelBooking[], costLines: CostLine[]) {
  const active = bookings.filter((booking) => booking.status !== "cancelled");
  const confirmedCount = active.filter((booking) => booking.status === "confirmed").length;
  const amounts = new Map<string, number>();
  let incomplete = false;
  for (const booking of active) {
    const lines = costLines.filter((line) => line.bookingId === booking.id);
    if (lines.length) {
      for (const line of lines) amounts.set(line.currency, (amounts.get(line.currency) || 0) + line.amountMinor);
    } else if (booking.totalAmountMinor != null && booking.currency) {
      amounts.set(booking.currency, (amounts.get(booking.currency) || 0) + booking.totalAmountMinor);
    } else {
      incomplete = true;
    }
  }
  return { count: active.length, confirmedCount, tentativeCount: active.length - confirmedCount, amounts: [...amounts.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor })), incomplete };
}
