import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, placeRecords, tripCityRecords, tripMemberRecords, tripRecords, tripSavedPlaceRecords } from "@/db/schema";
import { createAmapPlace, createManualPlace } from "@/services/place-repository.server";

async function storedTrip(slug: string) {
  return (await getDb().select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0] || null;
}

async function assertPlaceInTrip(tripId: string, placeId: string) {
  const row = (await getDb().select({ id: placeRecords.id }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, tripId))).where(eq(placeRecords.id, placeId)).limit(1))[0];
  if (!row) throw new Error("PLACE_NOT_IN_TRIP");
}

async function assertMember(tripId: string, memberId: string) {
  if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
}

export async function listSavedPlaces(slug: string, actorMemberId: string) {
  const trip = await storedTrip(slug);
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  await assertMember(trip.id, actorMemberId);
  return getDb().select({ saved: tripSavedPlaceRecords, place: placeRecords, city: cityRecords })
    .from(tripSavedPlaceRecords)
    .innerJoin(placeRecords, eq(placeRecords.id, tripSavedPlaceRecords.placeId))
    .innerJoin(cityRecords, eq(cityRecords.id, placeRecords.cityId))
    .where(eq(tripSavedPlaceRecords.tripId, trip.id))
    .orderBy(asc(tripSavedPlaceRecords.createdAt));
}

export async function savePlaceForTrip(slug: string, input: { placeId?: string; providerPlaceId?: string; cityId?: string; name?: string; address?: string | null }, actorMemberId: string) {
  const trip = await storedTrip(slug);
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  await assertMember(trip.id, actorMemberId);
  let placeId = input.placeId;
  if (input.providerPlaceId) {
    if (!input.cityId) throw new Error("CITY_REQUIRED");
    placeId = (await createAmapPlace(slug, { providerPlaceId: input.providerPlaceId, cityId: input.cityId }, actorMemberId)).id;
  } else if (!placeId && input.name && input.cityId) {
    placeId = (await createManualPlace(slug, { name: input.name, cityId: input.cityId, address: input.address ?? null }, actorMemberId)).id;
  }
  if (!placeId) throw new Error("PLACE_REQUIRED");
  await assertPlaceInTrip(trip.id, placeId);
  const existing = (await getDb().select().from(tripSavedPlaceRecords).where(and(eq(tripSavedPlaceRecords.tripId, trip.id), eq(tripSavedPlaceRecords.placeId, placeId))).limit(1))[0];
  if (existing) return existing;
  const now = new Date().toISOString();
  const saved = { id: crypto.randomUUID(), tripId: trip.id, placeId, createdByMemberId: actorMemberId, note: input.address ?? null, createdAt: now, updatedAt: now };
  await getDb().insert(tripSavedPlaceRecords).values(saved);
  return saved;
}

export async function deleteSavedPlace(slug: string, id: string, actorMemberId: string) {
  const trip = await storedTrip(slug);
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  await assertMember(trip.id, actorMemberId);
  const deleted = await getDb().delete(tripSavedPlaceRecords).where(and(eq(tripSavedPlaceRecords.id, id), eq(tripSavedPlaceRecords.tripId, trip.id))).returning({ id: tripSavedPlaceRecords.id });
  if (!deleted.length) throw new Error("SAVED_PLACE_NOT_FOUND");
  return true;
}
