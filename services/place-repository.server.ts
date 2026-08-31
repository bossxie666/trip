import { and, asc, eq, inArray, max } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, dayPlaceRecords, dayRecords, placeRecords, tripCityRecords, tripPlaceRecords, tripRecords } from "@/db/schema";

export type PlaceWorkspace = Awaited<ReturnType<typeof getPlaceWorkspace>>;

async function getStoredTrip(slug: string) {
  return (await getDb().select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0] || null;
}

export async function getPlaceWorkspace(slug: string) {
  const db = getDb();
  const trip = await getStoredTrip(slug);
  if (!trip) return null;
  const tripCities = await db.select({ id: cityRecords.id, name: cityRecords.name }).from(tripCityRecords).innerJoin(cityRecords, eq(tripCityRecords.cityId, cityRecords.id)).where(eq(tripCityRecords.tripId, trip.id)).orderBy(asc(tripCityRecords.position));
  const cityIds = tripCities.map((city) => city.id);
  const availablePlaces = cityIds.length ? await db.select().from(placeRecords).where(inArray(placeRecords.cityId, cityIds)).orderBy(asc(placeRecords.name)) : [];
  const tripPlaces = await db.select({ place: placeRecords, createdAt: tripPlaceRecords.createdAt }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).where(eq(tripPlaceRecords.tripId, trip.id)).orderBy(asc(tripPlaceRecords.createdAt));
  const days = await db.select().from(dayRecords).where(eq(dayRecords.tripId, trip.id)).orderBy(asc(dayRecords.dayNumber));
  const dayIds = days.map((day) => day.id);
  const links = dayIds.length ? await db.select({ dayId: dayPlaceRecords.dayId, sortOrder: dayPlaceRecords.sortOrder, note: dayPlaceRecords.note, arrivalTime: dayPlaceRecords.arrivalTime, departureTime: dayPlaceRecords.departureTime, place: placeRecords }).from(dayPlaceRecords).innerJoin(placeRecords, eq(dayPlaceRecords.placeId, placeRecords.id)).where(inArray(dayPlaceRecords.dayId, dayIds)).orderBy(asc(dayPlaceRecords.dayId), asc(dayPlaceRecords.sortOrder)) : [];
  return { tripId: trip.id, cities: tripCities, availablePlaces, tripPlaces, days: days.map((day) => ({ ...day, places: links.filter((link) => link.dayId === day.id) })) };
}

async function assertDayInTrip(tripId: string, dayId: string) {
  const day = (await getDb().select().from(dayRecords).where(and(eq(dayRecords.id, dayId), eq(dayRecords.tripId, tripId))).limit(1))[0];
  if (!day) throw new Error("DAY_NOT_IN_TRIP");
  return day;
}

async function ensureTripPlace(tripId: string, placeId: string) {
  const db = getDb();
  const existing = await db.select().from(tripPlaceRecords).where(and(eq(tripPlaceRecords.tripId, tripId), eq(tripPlaceRecords.placeId, placeId))).limit(1);
  if (!existing.length) await db.insert(tripPlaceRecords).values({ tripId, placeId, createdAt: new Date().toISOString() });
}

export async function createManualPlace(slug: string, input: { name: string; cityId: string; address: string | null }, actorMemberId: string) {
  const db = getDb();
  const trip = await getStoredTrip(slug); if (!trip) throw new Error("TRIP_NOT_FOUND");
  const cityLink = await db.select().from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, input.cityId))).limit(1);
  if (!cityLink.length) throw new Error("CITY_NOT_IN_TRIP");
  const existing = (await db.select().from(placeRecords).where(and(eq(placeRecords.cityId, input.cityId), eq(placeRecords.name, input.name))).limit(1))[0];
  if (existing) return existing;
  const now = new Date().toISOString();
  const place = { id: crypto.randomUUID(), name: input.name, cityId: input.cityId, address: input.address, latitude: null, longitude: null, coordinateSystem: null, provider: "manual" as const, providerPlaceId: null, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now };
  await db.insert(placeRecords).values(place); return place;
}

export async function addPlaceToDay(slug: string, dayId: string, placeId: string) {
  const db = getDb(); const trip = await getStoredTrip(slug); if (!trip) throw new Error("TRIP_NOT_FOUND");
  await assertDayInTrip(trip.id, dayId);
  const place = (await db.select().from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0]; if (!place) throw new Error("PLACE_NOT_FOUND");
  const tripCity = await db.select().from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, place.cityId))).limit(1); if (!tripCity.length) throw new Error("PLACE_CITY_NOT_IN_TRIP");
  await ensureTripPlace(trip.id, placeId);
  const duplicate = await db.select().from(dayPlaceRecords).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId))).limit(1); if (duplicate.length) return false;
  const highest = (await db.select({ value: max(dayPlaceRecords.sortOrder) }).from(dayPlaceRecords).where(eq(dayPlaceRecords.dayId, dayId)))[0]?.value || 0;
  await db.insert(dayPlaceRecords).values({ dayId, placeId, sortOrder: highest + 1 }); return true;
}

export async function reorderDayPlaces(slug: string, dayId: string, orderedPlaceIds: string[]) {
  const db = getDb(); const trip = await getStoredTrip(slug); if (!trip) throw new Error("TRIP_NOT_FOUND"); await assertDayInTrip(trip.id, dayId);
  const current = await db.select({ placeId: dayPlaceRecords.placeId }).from(dayPlaceRecords).where(eq(dayPlaceRecords.dayId, dayId));
  const currentIds = current.map((item) => item.placeId).sort(), requested = [...new Set(orderedPlaceIds)].sort();
  if (currentIds.length !== requested.length || currentIds.some((id, index) => id !== requested[index])) throw new Error("INVALID_ORDER");
  for (const [index, placeId] of orderedPlaceIds.entries()) await db.update(dayPlaceRecords).set({ sortOrder: -(index + 1) }).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId)));
  for (const [index, placeId] of orderedPlaceIds.entries()) await db.update(dayPlaceRecords).set({ sortOrder: index + 1 }).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId)));
}

export async function removePlaceFromDay(slug: string, dayId: string, placeId: string) {
  const db = getDb(); const trip = await getStoredTrip(slug); if (!trip) throw new Error("TRIP_NOT_FOUND"); await assertDayInTrip(trip.id, dayId);
  await db.delete(dayPlaceRecords).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId)));
  const remaining = await db.select({ placeId: dayPlaceRecords.placeId }).from(dayPlaceRecords).where(eq(dayPlaceRecords.dayId, dayId)).orderBy(asc(dayPlaceRecords.sortOrder));
  for (const [index, item] of remaining.entries()) await db.update(dayPlaceRecords).set({ sortOrder: index + 1 }).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, item.placeId)));
}

export async function removePlaceFromTrip(slug: string, placeId: string) {
  const db = getDb(); const trip = await getStoredTrip(slug); if (!trip) throw new Error("TRIP_NOT_FOUND");
  const used = await db.select({ dayId: dayPlaceRecords.dayId }).from(dayPlaceRecords).innerJoin(dayRecords, eq(dayPlaceRecords.dayId, dayRecords.id)).where(and(eq(dayRecords.tripId, trip.id), eq(dayPlaceRecords.placeId, placeId))).limit(1);
  if (used.length) throw new Error("PLACE_STILL_IN_DAY");
  await db.delete(tripPlaceRecords).where(and(eq(tripPlaceRecords.tripId, trip.id), eq(tripPlaceRecords.placeId, placeId)));
}

export async function updateManualPlace(placeId: string, input: { name: string; cityId: string; address: string | null }, actorMemberId: string) {
  const db = getDb(); const place = (await db.select().from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0];
  if (!place) throw new Error("PLACE_NOT_FOUND"); if (place.provider !== "manual") throw new Error("PLACE_NOT_MANUAL");
  const duplicate = await db.select().from(placeRecords).where(and(eq(placeRecords.cityId, input.cityId), eq(placeRecords.name, input.name))).limit(1);
  if (duplicate.some((item) => item.id !== placeId)) throw new Error("PLACE_DUPLICATE");
  await db.update(placeRecords).set({ name: input.name, cityId: input.cityId, address: input.address, updatedByMemberId: actorMemberId, updatedAt: new Date().toISOString() }).where(eq(placeRecords.id, placeId));
  return (await db.select().from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0];
}
