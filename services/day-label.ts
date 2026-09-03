export type DayLabelBooking = { type: string; startDateLocal?: string | null; endDateLocal?: string | null; startAt?: string | null; endAt?: string | null; timezone?: string | null; originPlace?: { cityId?: string | null } | null; destinationPlace?: { cityId?: string | null } | null; originLabel?: string | null; destinationLabel?: string | null };
export type DayLabelCity = { id: string; name: string };

function dayFromInstant(value: string | null | undefined, timezone?: string | null) {
  if (!value) return null;
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
      const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
      if (get("year") && get("month") && get("day")) return `${get("year")}-${get("month")}-${get("day")}`;
    } catch {
      // Fall through to the ISO clock for malformed/unsupported timezones.
    }
  }
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] || null;
}

/**
 * Resolve a safe day display label from reliable same-day long-distance data.
 * Existing day.title values are legacy planning prose in the current data
 * set, so they are intentionally ignored here; TripCity/Stage order and old
 * recommendation copy must never become an implicit route label.
 */
export function resolveDayLabel(day: { id: string; dayNumber: number; date?: string | null; title?: string | null }, bookings: DayLabelBooking[], cities: DayLabelCity[]) {
  void day.title;
  const matchingBookings = bookings.filter((booking) => {
    if (!["flight", "train", "other"].includes(booking.type)) return false;
    const start = booking.startDateLocal || dayFromInstant(booking.startAt, booking.timezone);
    const end = booking.endDateLocal || dayFromInstant(booking.endAt, booking.timezone) || start;
    return start === day.date || end === day.date;
  });
  const cityName = (cityId: string | null | undefined) => cities.find((city) => city.id === cityId)?.name || null;
  const labels = [...new Set(matchingBookings.map((booking) => {
    const origin = cityName(booking.originPlace?.cityId) || booking.originLabel || null;
    const destination = cityName(booking.destinationPlace?.cityId) || booking.destinationLabel || null;
    return origin && destination ? `${origin}→${destination}` : null;
  }).filter((label): label is string => Boolean(label)))];
  // Multiple people may arrive independently. A conflicting set of routes is
  // not a reliable Day title, so retain the neutral calendar label.
  if (labels.length === 1) return labels[0];
  return `Day ${day.dayNumber}`;
}
