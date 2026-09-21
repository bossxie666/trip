import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, tripCityRecords, tripRecords } from "@/db/schema";
import { listGuestbookMessages } from "@/services/guestbook-service.server";
import { listHomeFeaturedPhotos } from "@/services/media-service.server";
import { ensureCityCenter, listTrips } from "@/services/trip-repository.server";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getHomeDashboard(memberId: string) {
  const trips = await listTrips("all", memberId);
  const tripIds = trips.map((trip) => trip.id);
  const db = getDb();
  const cityRows = tripIds.length ? await db.select({
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
    .orderBy(asc(tripCityRecords.position)) : [];
  const resolvedCities = await Promise.all(cityRows.map(async (city) => {
    const resolved = await ensureCityCenter({ id: city.cityId, name: city.name, centerLat: city.centerLat, centerLng: city.centerLng });
    return { cityId: city.cityId, name: city.name, slug: city.slug, centerLat: resolved.centerLat, centerLng: resolved.centerLng, tripStatus: city.tripStatus };
  }));
  const cities = [...new Map(resolvedCities.map((city) => [city.cityId, city])).values()];
  const today = todayInShanghai();
  const upcoming = trips.filter((trip) => trip.status === "planning" && (!trip.endDate || trip.endDate >= today)).sort((left, right) => (left.startDate || "9999").localeCompare(right.startDate || "9999"))[0]
    || trips.find((trip) => trip.status === "planning") || null;
  const completed = trips.filter((trip) => trip.status === "completed").length;
  const cityCount = new Set(trips.flatMap((trip) => trip.cities.map((city) => city.id))).size;
  const [featuredPhotos, messages] = await Promise.all([listHomeFeaturedPhotos(), listGuestbookMessages(3)]);
  return {
    stats: { tripCount: trips.length, completed, cityCount },
    trips: trips.slice(0, 4),
    upcoming,
    cities,
    featuredPhotos,
    messages,
  };
}
