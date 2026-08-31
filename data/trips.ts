import { cities } from "./cities";
import type { Trip } from "@/models/travel";

export const trips: Trip[] = [
  {
    id: "trip-001",
    slug: "shanghai-hangzhou-2026",
    title: "上海 + 杭州",
    status: "planning",
    startDate: "2026-09-23",
    endDate: "2026-09-24",
    people: 4,
    cover: "/og.png",
    cities: cities.filter((city) => city.id === "shanghai" || city.id === "hangzhou"),
    days: [
      { id: "trip-001-day-1", tripId: "trip-001", date: "2026-09-23", title: "浦东落地 · 上海迪士尼", placeIds: ["pvg-t2", "shanghai-disney"] },
      { id: "trip-001-day-2", tripId: "trip-001", date: "2026-09-24", title: "陆家嘴 · 外滩 · 前往杭州", placeIds: ["oriental-pearl", "the-bund", "shanghai-south", "hangzhou-station"] },
    ],
    expenses: [
      { id: "flight-szx-sha", tripId: "trip-001", name: "深圳→上海机票", amount: 560, currency: "CNY", scope: "person", status: "estimated" },
      { id: "shanghai-disney-ticket", tripId: "trip-001", name: "上海迪士尼门票", amount: 366, currency: "CNY", scope: "person", status: "paid" },
    ],
    photos: [],
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    protected: true,
  },
];

export const protectedTripSlug = "shanghai-hangzhou-2026";

export function getAllTrips() {
  return trips;
}

export function getTripBySlug(slug: string) {
  return trips.find((trip) => trip.slug === slug);
}
