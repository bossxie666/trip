import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { bookingRecords, dayRecords, dayTimelinePositionRecords, itineraryItemRecords, tripRecords } from "../db/schema.ts";
import { buildDayTimeline } from "./planning-domain.mjs";
import type { DayTimelineEntry } from "../models/planning.ts";

export async function getDayTimeline(tripId: string, dayId: string): Promise<DayTimelineEntry[]> {
  const db = getDb();
  const context = (await db.select({ date: dayRecords.date, timezone: tripRecords.timezone }).from(dayRecords).innerJoin(tripRecords, eq(tripRecords.id, dayRecords.tripId)).where(and(eq(dayRecords.id, dayId), eq(dayRecords.tripId, tripId))).limit(1))[0];
  if (!context) throw new Error("DAY_NOT_IN_TRIP");
  if (!context.date || !context.timezone) throw new Error("TIMELINE_CONTEXT_INCOMPLETE");
  const [bookings, items, positions] = await Promise.all([
    db.select().from(bookingRecords).where(and(eq(bookingRecords.tripId, tripId), ne(bookingRecords.status, "cancelled"), isNull(bookingRecords.deletedAt))),
    db.select().from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, tripId), eq(itineraryItemRecords.dayId, dayId))).orderBy(asc(itineraryItemRecords.sortOrder)),
    db.select().from(dayTimelinePositionRecords).where(and(eq(dayTimelinePositionRecords.tripId, tripId), eq(dayTimelinePositionRecords.dayId, dayId))).orderBy(asc(dayTimelinePositionRecords.sortOrder)),
  ]);
  return buildDayTimeline({ dayDate: context.date, timezone: context.timezone, bookings, items, placements: positions.map((position) => ({ sourceType: position.sourceType, sourceId: position.sourceId, anchorType: position.anchorType, sortOrder: position.sortOrder })) });
}
