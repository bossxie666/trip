import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRecords, cityRecords, itineraryItemRecords, placeRecords, tripMemberRecords } from "@/db/schema";
import { listGuestbookMessages } from "@/services/guestbook-service.server";
import { listHomeFeaturedPhotos } from "@/services/media-service.server";
import { listTrips } from "@/services/trip-repository.server";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getHomeDashboard(memberId: string) {
  const allTrips = await listTrips("all");
  const trips = allTrips.filter((trip) => trip.members?.some((member) => member.id === memberId));
  const tripIds = trips.map((trip) => trip.id);
  const db = getDb();
  const [rawPoints, bookingEndpoints] = tripIds.length ? await Promise.all([db.select({
    tripId: itineraryItemRecords.tripId,
    placeId: placeRecords.id,
    name: placeRecords.name,
    cityName: cityRecords.name,
    latitude: placeRecords.latitude,
    longitude: placeRecords.longitude,
    sortOrder: itineraryItemRecords.sortOrder,
  }).from(itineraryItemRecords)
    .innerJoin(placeRecords, eq(itineraryItemRecords.placeId, placeRecords.id))
    .innerJoin(cityRecords, eq(placeRecords.cityId, cityRecords.id))
    .innerJoin(tripMemberRecords, and(eq(itineraryItemRecords.tripId, tripMemberRecords.tripId), eq(tripMemberRecords.memberId, memberId)))
    .where(and(inArray(itineraryItemRecords.tripId, tripIds), isNotNull(placeRecords.latitude), isNotNull(placeRecords.longitude)))
    .orderBy(asc(itineraryItemRecords.tripId), asc(itineraryItemRecords.dayId), asc(itineraryItemRecords.sortOrder)),
  db.select({ tripId: bookingRecords.tripId, originPlaceId: bookingRecords.originPlaceId, destinationPlaceId: bookingRecords.destinationPlaceId })
    .from(bookingRecords)
    .innerJoin(tripMemberRecords, and(eq(bookingRecords.tripId, tripMemberRecords.tripId), eq(tripMemberRecords.memberId, memberId)))
    .where(and(inArray(bookingRecords.tripId, tripIds), isNull(bookingRecords.deletedAt)))]) : [[], []];
  const endpointIds = bookingEndpoints.flatMap((booking) => [booking.originPlaceId, booking.destinationPlaceId]).filter((id): id is string => Boolean(id));
  const endpointRows = endpointIds.length ? await db.select({
    placeId: placeRecords.id,
    name: placeRecords.name,
    cityName: cityRecords.name,
    latitude: placeRecords.latitude,
    longitude: placeRecords.longitude,
  }).from(placeRecords).innerJoin(cityRecords, eq(placeRecords.cityId, cityRecords.id))
    .where(and(inArray(placeRecords.id, endpointIds), isNotNull(placeRecords.latitude), isNotNull(placeRecords.longitude))) : [];
  const endpointById = new Map(endpointRows.map((point) => [point.placeId, point]));
  const orderedEndpoints = endpointIds.flatMap((id) => endpointById.get(id) ? [endpointById.get(id)!] : []);
  const points = [...new Map([...orderedEndpoints, ...rawPoints].map((point) => [point.placeId, point])).values()].slice(0, 10);
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
    points,
    featuredPhotos,
    messages,
  };
}
