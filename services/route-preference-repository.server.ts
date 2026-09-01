import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRecords, dayRecords, itineraryItemRecords, memberRecords, routePreferenceRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import type { RoutePreferenceMode, RouteSource } from "@/models/planning";

type SegmentInput = { dayId: string; fromSource: RouteSource; fromId: string; toSource: RouteSource; toId: string; memberId?: string | null; preferredMode: RoutePreferenceMode };

async function assertSegment(tripId: string, input: SegmentInput) {
  if (!(await getDb().select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, tripId))).limit(1))[0]) throw new Error("DAY_NOT_IN_TRIP");
  const db = getDb();
  for (const [source, id] of [[input.fromSource, input.fromId], [input.toSource, input.toId]] as const) {
    const table = source === "itinerary" ? itineraryItemRecords : bookingRecords;
    // Route stops may use a `booking-id:origin|destination` display key so
    // two anchors from one booking stay distinct.  Validate the underlying
    // Booking id while retaining the display key in the lightweight
    // preference record.
    const storedId = source === "booking" ? id.split(":", 1)[0] : id;
    if (!(await db.select({ id: table.id }).from(table).where(and(eq(table.id, storedId), eq(table.tripId, tripId))).limit(1))[0]) throw new Error("SEGMENT_POINT_NOT_IN_TRIP");
  }
  if (input.memberId && !(await getDb().select({ id: memberRecords.id }).from(memberRecords).innerJoin(tripMemberRecords, eq(tripMemberRecords.memberId, memberRecords.id)).where(and(eq(tripMemberRecords.tripId, tripId), eq(memberRecords.id, input.memberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
}

export async function listRoutePreferences(slug: string, dayId?: string, memberId?: string | null) {
  const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  const filters = [eq(routePreferenceRecords.tripId, trip.id)];
  if (dayId) filters.push(eq(routePreferenceRecords.dayId, dayId));
  if (memberId) filters.push(eq(routePreferenceRecords.memberId, memberId));
  else if (memberId === null) filters.push(isNull(routePreferenceRecords.memberId));
  return getDb().select().from(routePreferenceRecords).where(and(...filters)).orderBy(asc(routePreferenceRecords.updatedAt), asc(routePreferenceRecords.id));
}

export async function upsertRoutePreference(slug: string, input: SegmentInput, actorMemberId: string) {
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  await assertSegment(trip.id, input);
  const memberId = input.memberId ?? null;
  const existing = (await db.select().from(routePreferenceRecords).where(and(eq(routePreferenceRecords.tripId, trip.id), eq(routePreferenceRecords.dayId, input.dayId), eq(routePreferenceRecords.fromSource, input.fromSource), eq(routePreferenceRecords.fromId, input.fromId), eq(routePreferenceRecords.toSource, input.toSource), eq(routePreferenceRecords.toId, input.toId), memberId ? eq(routePreferenceRecords.memberId, memberId) : isNull(routePreferenceRecords.memberId))).limit(1))[0];
  const now = new Date().toISOString();
  if (existing) {
    await db.update(routePreferenceRecords).set({ preferredMode: input.preferredMode, updatedByMemberId: actorMemberId, updatedAt: now }).where(eq(routePreferenceRecords.id, existing.id));
    return (await db.select().from(routePreferenceRecords).where(eq(routePreferenceRecords.id, existing.id)).limit(1))[0];
  }
  const record = { id: crypto.randomUUID(), tripId: trip.id, dayId: input.dayId, fromSource: input.fromSource, fromId: input.fromId, toSource: input.toSource, toId: input.toId, memberId, preferredMode: input.preferredMode, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now };
  await db.insert(routePreferenceRecords).values(record);
  return record;
}
