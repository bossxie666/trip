import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookingCostAllocationRecords, bookingCostLineRecords, bookingRecords, dayRecords,
  itineraryItemRecords, memberRecords, placeRecords, recommendationPlaceOptionRecords,
  recommendationRecords, tripMemberRecords, tripRecords,
} from "@/db/schema";
import { findTripBySlug } from "@/services/trip-repository.server";
import { getDayTimeline } from "@/services/day-timeline-service.server";

export async function getPlanWorkspace(slug: string) {
  const trip = await findTripBySlug(slug);
  if (!trip) return null;
  const db = getDb();
  const stored = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!stored) return { trip, days: [], recommendations: [], bookings: [], costLines: [], presenceUnknown: true };

  const [days, recommendations, options, items, bookings, costLines, allocations, presenceRows] = await Promise.all([
    db.select().from(dayRecords).where(eq(dayRecords.tripId, stored.id)).orderBy(asc(dayRecords.dayNumber)),
    db.select().from(recommendationRecords).where(and(eq(recommendationRecords.tripId, stored.id), isNull(recommendationRecords.deletedAt))).orderBy(asc(recommendationRecords.createdAt), asc(recommendationRecords.id)),
    db.select({ option: recommendationPlaceOptionRecords, place: placeRecords }).from(recommendationPlaceOptionRecords).innerJoin(recommendationRecords, eq(recommendationRecords.id, recommendationPlaceOptionRecords.recommendationId)).innerJoin(placeRecords, eq(placeRecords.id, recommendationPlaceOptionRecords.placeId)).where(and(eq(recommendationRecords.tripId, stored.id), isNull(recommendationRecords.deletedAt))).orderBy(asc(recommendationPlaceOptionRecords.sortOrder)),
    db.select({ item: itineraryItemRecords, place: placeRecords, recommendationTitle: recommendationRecords.title }).from(itineraryItemRecords).leftJoin(placeRecords, eq(placeRecords.id, itineraryItemRecords.placeId)).leftJoin(recommendationRecords, eq(recommendationRecords.id, itineraryItemRecords.recommendationId)).where(eq(itineraryItemRecords.tripId, stored.id)).orderBy(asc(itineraryItemRecords.dayId), asc(itineraryItemRecords.sortOrder), asc(itineraryItemRecords.id)),
    db.select({ booking: bookingRecords, place: placeRecords }).from(bookingRecords).leftJoin(placeRecords, eq(placeRecords.id, bookingRecords.placeId)).where(and(eq(bookingRecords.tripId, stored.id), eq(bookingRecords.status, "confirmed"), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingRecords.startAt), asc(bookingRecords.startDateLocal), asc(bookingRecords.id)),
    db.select().from(bookingCostLineRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingCostLineRecords.sortOrder)),
    db.select({ allocation: bookingCostAllocationRecords, memberName: memberRecords.displayName }).from(bookingCostAllocationRecords).innerJoin(bookingCostLineRecords, eq(bookingCostLineRecords.id, bookingCostAllocationRecords.costLineId)).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).innerJoin(memberRecords, eq(memberRecords.id, bookingCostAllocationRecords.memberId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingCostAllocationRecords.memberId)),
    db.select().from(tripMemberRecords).where(eq(tripMemberRecords.tripId, stored.id)),
  ]);

  const timelineByDay = new Map<string, Awaited<ReturnType<typeof getDayTimeline>>>();
  for (const day of days) {
    if (day.date && stored.timezone) timelineByDay.set(day.id, await getDayTimeline(stored.id, day.id));
    else timelineByDay.set(day.id, items.filter(({ item }) => item.dayId === day.id).map(({ item }) => ({ source: "itinerary" as const, sourceId: item.id, entryType: "itinerary-item" as const, bucket: "untimed" as const, title: item.title, timeLocal: item.startTimeLocal, sortOrder: item.sortOrder, locked: item.lockedAt != null })));
  }

  return {
    trip,
    days: days.map((day) => ({ ...day, items: items.filter(({ item }) => item.dayId === day.id), timeline: timelineByDay.get(day.id) || [] })),
    recommendations: recommendations.map((recommendation) => ({ ...recommendation, options: options.filter(({ option }) => option.recommendationId === recommendation.id), addedDays: items.filter(({ item }) => item.recommendationId === recommendation.id).map(({ item }) => item.dayId), locked: items.some(({ item }) => item.recommendationId === recommendation.id && item.lockedAt != null) })),
    bookings,
    costLines: costLines.map(({ booking_cost_lines: line, bookings: booking }) => ({ ...line, bookingTitle: booking.title, allocations: allocations.filter(({ allocation }) => allocation.costLineId === line.id) })),
    presenceUnknown: presenceRows.some((row) => row.presenceCoverage === "unknown"),
  };
}

export async function getNewPlanRoutePlaces(slug: string, originPlaceId: string, destinationPlaceId: string) {
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  const ids = [originPlaceId, destinationPlaceId];
  const allowed = await db.selectDistinct({ id: placeRecords.id }).from(placeRecords)
    .leftJoin(itineraryItemRecords, and(eq(itineraryItemRecords.placeId, placeRecords.id), eq(itineraryItemRecords.tripId, trip.id)))
    .leftJoin(bookingRecords, and(eq(bookingRecords.placeId, placeRecords.id), eq(bookingRecords.tripId, trip.id), eq(bookingRecords.status, "confirmed"), isNull(bookingRecords.deletedAt)))
    .leftJoin(recommendationPlaceOptionRecords, eq(recommendationPlaceOptionRecords.placeId, placeRecords.id))
    .leftJoin(recommendationRecords, and(eq(recommendationRecords.id, recommendationPlaceOptionRecords.recommendationId), eq(recommendationRecords.tripId, trip.id), isNull(recommendationRecords.deletedAt)))
    .where(and(inArray(placeRecords.id, ids), or(eq(itineraryItemRecords.tripId, trip.id), eq(bookingRecords.tripId, trip.id), eq(recommendationRecords.tripId, trip.id))));
  if (allowed.length !== 2) throw new Error("PLACE_NOT_IN_TRIP");
  const places = await db.select().from(placeRecords).where(inArray(placeRecords.id, ids));
  const origin = places.find((place) => place.id === originPlaceId), destination = places.find((place) => place.id === destinationPlaceId);
  if (!origin || !destination) throw new Error("PLACE_NOT_IN_TRIP");
  if (origin.latitude == null || origin.longitude == null || destination.latitude == null || destination.longitude == null) throw new Error("PLACE_MISSING_COORDINATES");
  return { origin, destination };
}
