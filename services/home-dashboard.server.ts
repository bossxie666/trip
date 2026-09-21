import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, tripCityRecords, tripRecords } from "@/db/schema";
import { listGuestbookMessages } from "@/services/guestbook-service.server";
import { listHomeFeaturedPhotos } from "@/services/media-service.server";
import { listTripSummaries } from "@/services/trip-repository.server";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getHomeDashboard(memberId: string) {
  const db = getDb();
  const trips = await listTripSummaries("all", memberId);
  const tripIds = trips.map((trip) => trip.id);
  const cityRowsPromise = tripIds.length ? db.select({
    cityId: cityRecords.id,
    name: cityRecords.name,
    slug: cityRecords.slug,
    centerLat: cityRecords.centerLat,
    centerLng: cityRecords.centerLng,
    tripStatus: tripRecords.status,
    position: tripCityRecords.position,
  }).from(tripCityRecords)
    .innerJoin(cityRecords, eq(tripCityRecords.cityId, cityRecords.id))
    .innerJoin(tripRecords, eq(tripCityRecords.tripId, tripRecords.id))
    .where(inArray(tripCityRecords.tripId, tripIds))
    .orderBy(asc(tripCityRecords.position)) : Promise.resolve([]);
  const [cityRows, featuredPhotos, messages] = await Promise.all([
    cityRowsPromise,
    listHomeFeaturedPhotos(),
    listGuestbookMessages(3),
  ]);
  // Coordinates are populated when a city is created. A missing coordinate
  // must never trigger an external geocoder while rendering the homepage.
  const cities = [...new Map(cityRows.map((city) => [city.cityId, city])).values()];
  const today = todayInShanghai();
  const upcoming = trips.filter((trip) => trip.status === "planning" && (!trip.endDate || trip.endDate >= today)).sort((left, right) => (left.startDate || "9999").localeCompare(right.startDate || "9999"))[0]
    || trips.find((trip) => trip.status === "planning") || null;
  const completed = trips.filter((trip) => trip.status === "completed").length;
  const cityCount = cities.length;
  return {
    stats: { tripCount: trips.length, completed, cityCount },
    trips: trips.slice(0, 4),
    upcoming,
    cities,
    featuredPhotos,
    messages,
  };
}
