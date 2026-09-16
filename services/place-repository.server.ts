import { and, asc, eq, inArray, max, or } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRecords, cityRecords, dayPlaceRecords, dayRecords, itineraryItemRecords, placeRecords, recommendationPlaceOptionRecords, tripCityRecords, tripMemberRecords, tripPlaceRecords, tripRecords, tripStageRecords } from "@/db/schema";
import { getAmapPoi } from "@/services/amap/amap-web-service.server";
import type { TripPlaceStatus } from "@/models/travel";

export type PlaceWorkspace = Awaited<ReturnType<typeof getPlaceWorkspace>>;

async function getStoredTrip(slug: string) {
  return (await getDb().select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0] || null;
}

async function assertTripMember(tripId: string, memberId: string) {
  const membership = (await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0];
  if (!membership) throw new Error("MEMBER_NOT_IN_TRIP");
}

async function getStoredTripForMember(slug: string, memberId: string) {
  const trip = await getStoredTrip(slug);
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  await assertTripMember(trip.id, memberId);
  return trip;
}

export async function getPlaceWorkspace(slug: string, memberId: string) {
  const db = getDb();
  const trip = await getStoredTrip(slug);
  if (!trip) return null;
  await assertTripMember(trip.id, memberId);
  const tripCities = await db.select({ id: cityRecords.id, name: cityRecords.name }).from(tripCityRecords).innerJoin(cityRecords, eq(tripCityRecords.cityId, cityRecords.id)).where(eq(tripCityRecords.tripId, trip.id)).orderBy(asc(tripCityRecords.position));
  const cityIds = tripCities.map((city) => city.id);
  const stages = await db.select({ id: tripStageRecords.id, cityId: tripStageRecords.cityId, citySlug: cityRecords.slug, cityName: cityRecords.name, title: tripStageRecords.title, sortOrder: tripStageRecords.sortOrder, createdAt: tripStageRecords.createdAt, updatedAt: tripStageRecords.updatedAt }).from(tripStageRecords).innerJoin(cityRecords, eq(tripStageRecords.cityId, cityRecords.id)).where(eq(tripStageRecords.tripId, trip.id)).orderBy(asc(tripStageRecords.sortOrder));
  const availablePlaces = cityIds.length ? await db.select().from(placeRecords).where(inArray(placeRecords.cityId, cityIds)).orderBy(asc(placeRecords.name)) : [];
  const tripPlaces = await db.select({ place: placeRecords, planStatus: tripPlaceRecords.planStatus, createdAt: tripPlaceRecords.createdAt }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).where(eq(tripPlaceRecords.tripId, trip.id)).orderBy(asc(tripPlaceRecords.createdAt));
  const days = await db.select().from(dayRecords).where(eq(dayRecords.tripId, trip.id)).orderBy(asc(dayRecords.dayNumber));
  const dayIds = days.map((day) => day.id);
  const links = dayIds.length ? await db.select({ dayId: dayPlaceRecords.dayId, sortOrder: dayPlaceRecords.sortOrder, note: dayPlaceRecords.note, arrivalTime: dayPlaceRecords.arrivalTime, departureTime: dayPlaceRecords.departureTime, planStatus: tripPlaceRecords.planStatus, place: placeRecords }).from(dayPlaceRecords).innerJoin(tripPlaceRecords, and(eq(tripPlaceRecords.tripId, trip.id), eq(tripPlaceRecords.placeId, dayPlaceRecords.placeId))).innerJoin(placeRecords, eq(dayPlaceRecords.placeId, placeRecords.id)).where(inArray(dayPlaceRecords.dayId, dayIds)).orderBy(asc(dayPlaceRecords.dayId), asc(dayPlaceRecords.sortOrder)) : [];
  return { tripId: trip.id, cities: tripCities, stages: stages.map((stage) => ({ id: stage.id, tripId: trip.id, cityId: stage.cityId, title: stage.title, sortOrder: stage.sortOrder, createdAt: stage.createdAt, updatedAt: stage.updatedAt, city: { id: stage.cityId, slug: stage.citySlug, name: stage.cityName } })), availablePlaces, tripPlaces, days: days.map((day) => ({ ...day, places: links.filter((link) => link.dayId === day.id) })) };
}

async function assertDayInTrip(tripId: string, dayId: string) {
  const day = (await getDb().select().from(dayRecords).where(and(eq(dayRecords.id, dayId), eq(dayRecords.tripId, tripId))).limit(1))[0];
  if (!day) throw new Error("DAY_NOT_IN_TRIP");
  return day;
}

async function ensureTripPlace(tripId: string, placeId: string, planStatus: TripPlaceStatus = "candidate") {
  const db = getDb();
  const existing = await db.select().from(tripPlaceRecords).where(and(eq(tripPlaceRecords.tripId, tripId), eq(tripPlaceRecords.placeId, placeId))).limit(1);
  if (!existing.length) await db.insert(tripPlaceRecords).values({ tripId, placeId, planStatus, createdAt: new Date().toISOString() });
  else if (planStatus === "selected" && existing[0].planStatus === "candidate") await db.update(tripPlaceRecords).set({ planStatus }).where(and(eq(tripPlaceRecords.tripId, tripId), eq(tripPlaceRecords.placeId, placeId)));
}

export async function createManualPlace(slug: string, input: { name: string; cityId: string; address: string | null; longitude?: number | null; latitude?: number | null }, actorMemberId: string) {
  const db = getDb();
  const trip = await getStoredTripForMember(slug, actorMemberId);
  const cityLink = await db.select().from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, input.cityId))).limit(1);
  if (!cityLink.length) throw new Error("CITY_NOT_IN_TRIP");
  const existing = (await db.select().from(placeRecords).where(and(eq(placeRecords.cityId, input.cityId), eq(placeRecords.name, input.name))).limit(1))[0];
  if (existing) return existing;
  const now = new Date().toISOString();
  if (input.longitude != null && (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)) throw new Error("INVALID_LONGITUDE");
  if (input.latitude != null && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)) throw new Error("INVALID_LATITUDE");
  const place = { id: crypto.randomUUID(), name: input.name, cityId: input.cityId, address: input.address, latitude: input.latitude ?? null, longitude: input.longitude ?? null, coordinateSystem: input.latitude != null && input.longitude != null ? "GCJ02" as const : null, provider: "manual" as const, providerPlaceId: null, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now };
  await db.insert(placeRecords).values(place); return place;
}

export async function createAmapPlace(slug: string, input: { providerPlaceId: string; cityId?: string | null }, actorMemberId: string) {
  const db = getDb(), trip = await getStoredTripForMember(slug, actorMemberId);
  const existing = (await db.select().from(placeRecords).where(and(eq(placeRecords.provider, "amap"), eq(placeRecords.providerPlaceId, input.providerPlaceId))).limit(1))[0];
  if (existing) {
    const link = await db.select().from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, existing.cityId))).limit(1);
    if (!link.length) {
      const links = await db.select().from(tripCityRecords).where(eq(tripCityRecords.tripId, trip.id));
      await db.insert(tripCityRecords).values({ tripId: trip.id, cityId: existing.cityId, position: links.length });
    }
    return existing;
  }
  const poi = await getAmapPoi(input.providerPlaceId), now = new Date().toISOString();
  let city = input.cityId ? (await db.select().from(cityRecords).where(eq(cityRecords.id, input.cityId)).limit(1))[0] : null;
  if (!city) {
    const cityName = (poi.cityName || poi.provinceName || poi.district || "未知地区").replace(/市$/, "");
    city = (await db.select().from(cityRecords).where(eq(cityRecords.name, cityName)).limit(1))[0];
    if (!city) { const id = crypto.randomUUID(); city = { id, slug: `city-${id.slice(0, 8)}`, name: cityName, createdAt: now }; await db.insert(cityRecords).values(city); }
  }
  const cityLink = await db.select().from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, city.id))).limit(1);
  if (!cityLink.length) {
    const links = await db.select().from(tripCityRecords).where(eq(tripCityRecords.tripId, trip.id));
    await db.insert(tripCityRecords).values({ tripId: trip.id, cityId: city.id, position: links.length });
  }
  const sameName = (await db.select().from(placeRecords).where(and(eq(placeRecords.cityId, city.id), eq(placeRecords.name, poi.name))).limit(1))[0];
  if (sameName?.provider === "manual") {
    await db.update(placeRecords).set({ address: poi.address, latitude: poi.latitude, longitude: poi.longitude, coordinateSystem: "GCJ02", provider: "amap", providerPlaceId: poi.id, adcode: poi.adcode, cityCode: poi.cityCode, district: poi.district, typeCode: poi.typeCode, providerUpdatedAt: now, updatedByMemberId: actorMemberId, updatedAt: now }).where(eq(placeRecords.id, sameName.id));
    return (await db.select().from(placeRecords).where(eq(placeRecords.id, sameName.id)).limit(1))[0];
  }
  const place = { id: crypto.randomUUID(), name: poi.name, cityId: city.id, address: poi.address, latitude: poi.latitude, longitude: poi.longitude, coordinateSystem: "GCJ02" as const, provider: "amap" as const, providerPlaceId: poi.id, adcode: poi.adcode, cityCode: poi.cityCode, district: poi.district, typeCode: poi.typeCode, providerUpdatedAt: now, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now };
  await db.insert(placeRecords).values(place); return place;
}

export async function getRoutePlaces(slug: string, originPlaceId: string, destinationPlaceId: string, actorMemberId: string) {
  const db = getDb(), trip = await getStoredTripForMember(slug, actorMemberId);
  const linked = await db.select({ place: placeRecords, planStatus: tripPlaceRecords.planStatus }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).where(and(eq(tripPlaceRecords.tripId, trip.id), inArray(tripPlaceRecords.placeId, [originPlaceId, destinationPlaceId])));
  const origin = linked.find((item) => item.place.id === originPlaceId && (item.planStatus === "selected" || item.planStatus === "locked"))?.place, destination = linked.find((item) => item.place.id === destinationPlaceId && (item.planStatus === "selected" || item.planStatus === "locked"))?.place;
  if (!origin || !destination) throw new Error("PLACE_NOT_IN_TRIP");
  if (origin.latitude == null || origin.longitude == null || destination.latitude == null || destination.longitude == null) throw new Error("PLACE_MISSING_COORDINATES");
  return { origin, destination };
}

export async function addPlaceToDay(slug: string, dayId: string, placeId: string, actorMemberId: string) {
  const db = getDb(); const trip = await getStoredTripForMember(slug, actorMemberId);
  await assertDayInTrip(trip.id, dayId);
  const place = (await db.select().from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0]; if (!place) throw new Error("PLACE_NOT_FOUND");
  const tripCity = await db.select().from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, place.cityId))).limit(1); if (!tripCity.length) throw new Error("PLACE_CITY_NOT_IN_TRIP");
  await ensureTripPlace(trip.id, placeId, "selected");
  const duplicate = await db.select().from(dayPlaceRecords).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId))).limit(1); if (duplicate.length) return false;
  const highest = (await db.select({ value: max(dayPlaceRecords.sortOrder) }).from(dayPlaceRecords).where(eq(dayPlaceRecords.dayId, dayId)))[0]?.value || 0;
  await db.insert(dayPlaceRecords).values({ dayId, placeId, sortOrder: highest + 1 }); return true;
}

export async function setTripPlaceStatus(slug: string, placeId: string, planStatus: TripPlaceStatus, actorMemberId: string) {
  const db = getDb(); const trip = await getStoredTripForMember(slug, actorMemberId);
  const existing = await db.select({ placeId: tripPlaceRecords.placeId }).from(tripPlaceRecords).where(and(eq(tripPlaceRecords.tripId, trip.id), eq(tripPlaceRecords.placeId, placeId))).limit(1);
  if (!existing.length) throw new Error("PLACE_NOT_IN_TRIP");
  await db.update(tripPlaceRecords).set({ planStatus }).where(and(eq(tripPlaceRecords.tripId, trip.id), eq(tripPlaceRecords.placeId, placeId)));
}

export async function reorderDayPlaces(slug: string, dayId: string, orderedPlaceIds: string[], actorMemberId: string) {
  const db = getDb(); const trip = await getStoredTripForMember(slug, actorMemberId); await assertDayInTrip(trip.id, dayId);
  const current = await db.select({ placeId: dayPlaceRecords.placeId }).from(dayPlaceRecords).where(eq(dayPlaceRecords.dayId, dayId));
  const currentIds = current.map((item) => item.placeId).sort(), requested = [...new Set(orderedPlaceIds)].sort();
  if (currentIds.length !== requested.length || currentIds.some((id, index) => id !== requested[index])) throw new Error("INVALID_ORDER");
  for (const [index, placeId] of orderedPlaceIds.entries()) await db.update(dayPlaceRecords).set({ sortOrder: -(index + 1) }).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId)));
  for (const [index, placeId] of orderedPlaceIds.entries()) await db.update(dayPlaceRecords).set({ sortOrder: index + 1 }).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId)));
}

export async function removePlaceFromDay(slug: string, dayId: string, placeId: string, actorMemberId: string) {
  const db = getDb(); const trip = await getStoredTripForMember(slug, actorMemberId); await assertDayInTrip(trip.id, dayId);
  await db.delete(dayPlaceRecords).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, placeId)));
  const remaining = await db.select({ placeId: dayPlaceRecords.placeId }).from(dayPlaceRecords).where(eq(dayPlaceRecords.dayId, dayId)).orderBy(asc(dayPlaceRecords.sortOrder));
  for (const [index, item] of remaining.entries()) await db.update(dayPlaceRecords).set({ sortOrder: index + 1 }).where(and(eq(dayPlaceRecords.dayId, dayId), eq(dayPlaceRecords.placeId, item.placeId)));
}

export async function removePlaceFromTrip(slug: string, placeId: string, actorMemberId: string) {
  const db = getDb(); const trip = await getStoredTripForMember(slug, actorMemberId);
  const used = await db.select({ dayId: dayPlaceRecords.dayId }).from(dayPlaceRecords).innerJoin(dayRecords, eq(dayPlaceRecords.dayId, dayRecords.id)).where(and(eq(dayRecords.tripId, trip.id), eq(dayPlaceRecords.placeId, placeId))).limit(1);
  if (used.length) throw new Error("PLACE_STILL_IN_DAY");
  await db.delete(tripPlaceRecords).where(and(eq(tripPlaceRecords.tripId, trip.id), eq(tripPlaceRecords.placeId, placeId)));
}

export async function updateManualPlace(placeId: string, input: { name: string; cityId: string; address: string | null }, actorMemberId: string) {
  const db = getDb(); const place = (await db.select().from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0];
  if (!place) throw new Error("PLACE_NOT_FOUND"); if (place.provider !== "manual") throw new Error("PLACE_NOT_MANUAL");
  const ownsPlace = place.createdByMemberId === actorMemberId;
  const sharedMembership = (await db.select({ tripId: tripMemberRecords.tripId }).from(tripPlaceRecords)
    .innerJoin(tripMemberRecords, eq(tripMemberRecords.tripId, tripPlaceRecords.tripId))
    .where(and(eq(tripPlaceRecords.placeId, placeId), eq(tripMemberRecords.memberId, actorMemberId))).limit(1))[0];
  if (!ownsPlace && !sharedMembership) throw new Error("PLACE_MEMBER_REQUIRED");
  const duplicate = await db.select().from(placeRecords).where(and(eq(placeRecords.cityId, input.cityId), eq(placeRecords.name, input.name))).limit(1);
  if (duplicate.some((item) => item.id !== placeId)) throw new Error("PLACE_DUPLICATE");
  await db.update(placeRecords).set({ name: input.name, cityId: input.cityId, address: input.address, updatedByMemberId: actorMemberId, updatedAt: new Date().toISOString() }).where(eq(placeRecords.id, placeId));
  return (await db.select().from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0];
}

export async function deletePlaceSafely(placeId: string) {
  const db = getDb();
  const [recommendationUse, itineraryUse, bookingUse, legacyDayUse, legacyTripUse] = await Promise.all([
    db.select({ id: recommendationPlaceOptionRecords.id }).from(recommendationPlaceOptionRecords).where(eq(recommendationPlaceOptionRecords.placeId, placeId)).limit(1),
    db.select({ id: itineraryItemRecords.id }).from(itineraryItemRecords).where(or(eq(itineraryItemRecords.placeId, placeId), eq(itineraryItemRecords.originPlaceId, placeId), eq(itineraryItemRecords.destinationPlaceId, placeId))).limit(1),
    db.select({ id: bookingRecords.id }).from(bookingRecords).where(or(eq(bookingRecords.placeId, placeId), eq(bookingRecords.originPlaceId, placeId), eq(bookingRecords.destinationPlaceId, placeId))).limit(1),
    db.select({ id: dayPlaceRecords.dayId }).from(dayPlaceRecords).where(eq(dayPlaceRecords.placeId, placeId)).limit(1),
    db.select({ id: tripPlaceRecords.tripId }).from(tripPlaceRecords).where(eq(tripPlaceRecords.placeId, placeId)).limit(1),
  ]);
  if (recommendationUse.length || itineraryUse.length || bookingUse.length || legacyDayUse.length || legacyTripUse.length) throw new Error("PLACE_STILL_REFERENCED");
  const deleted = await db.delete(placeRecords).where(eq(placeRecords.id, placeId)).returning({ id: placeRecords.id });
  return deleted.length > 0;
}
