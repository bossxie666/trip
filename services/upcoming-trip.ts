export function selectUpcomingTrip<T extends { status: string; startDate: string | null; endDate: string | null }>(trips: T[], today: string): T | null {
  return trips.filter((trip) => trip.status === "planning" && (!trip.endDate || trip.endDate >= today))
    .sort((left, right) => (left.startDate || "9999").localeCompare(right.startDate || "9999"))[0] || null;
}
