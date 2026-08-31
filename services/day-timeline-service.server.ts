import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { bookingRecords, dayRecords, itineraryItemRecords, tripRecords } from "../db/schema.ts";
import { buildDayTimeline } from "./planning-domain.mjs";
import type { DayTimelineEntry } from "../models/planning.ts";

export async function getDayTimeline(tripId: string, dayId: string): Promise<DayTimelineEntry[]> {
  const db = getDb();
  const context = (await db.select({ date: dayRecords.date, timezone: tripRecords.timezone }).from(dayRecords).innerJoin(tripRecords, eq(tripRecords.id, dayRecords.tripId)).where(and(eq(dayRecords.id, dayId), eq(dayRecords.tripId, tripId))).limit(1))[0];
  if (!context) throw new Error("DAY_NOT_IN_TRIP");
  if (!context.date || !context.timezone) throw new Error("TIMELINE_CONTEXT_INCOMPLETE");
  const [bookings, items] = await Promise.all([
    db.select().from(bookingRecords).where(and(eq(bookingRecords.tripId, tripId), eq(bookingRecords.status, "confirmed"), isNull(bookingRecords.deletedAt))),
    db.select().from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, tripId), eq(itineraryItemRecords.dayId, dayId))).orderBy(asc(itineraryItemRecords.sortOrder)),
  ]);
  return buildDayTimeline({ dayDate: context.date, timezone: context.timezone, bookings, items });
}
