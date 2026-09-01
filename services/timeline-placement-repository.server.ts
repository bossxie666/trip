import { and, asc, eq } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "../db/index.ts";
import { dayRecords, dayTimelinePositionRecords } from "../db/schema.ts";
import { getDayTimeline } from "./day-timeline-service.server.ts";

export type TimelinePlacementInput = { source: "itinerary" | "booking"; sourceId: string; anchorKind?: string | null };

function anchorType(entry: TimelinePlacementInput) {
  if (entry.source === "itinerary") return "other";
  if (entry.anchorKind === "start") return "departure";
  if (entry.anchorKind === "end") return "arrival";
  if (entry.anchorKind === "stay") return "stay";
  return "other";
}

function entryKey(entry: TimelinePlacementInput | { source: "itinerary" | "booking"; sourceId: string; anchorKind?: string | null }) {
  return `${entry.source}:${entry.sourceId}:${anchorType(entry)}`;
}

/** Replace only the display-placement rows. Booking and itinerary facts are
 * never changed; stale placement rows are left harmlessly for auditability. */
export async function replaceDayTimelinePositions(input: { tripId: string; dayId: string; entries: TimelinePlacementInput[]; actorMemberId: string }) {
  const db = getDb();
  const day = (await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, input.tripId))).limit(1))[0];
  if (!day) throw new Error("DAY_NOT_IN_TRIP");
  const current = await getDayTimeline(input.tripId, input.dayId);
  const allowed = new Map(current.map((entry) => [entryKey(entry), entry]));
  const seen = new Set<string>();
  const entries = input.entries.map((entry) => ({ source: entry.source, sourceId: String(entry.sourceId), anchorKind: entry.anchorKind || null }));
  for (const entry of entries) {
    const key = entryKey(entry);
    if (seen.has(key) || !allowed.has(key)) throw new Error("INVALID_TIMELINE_ORDER");
    seen.add(key);
  }
  if (seen.size !== allowed.size) throw new Error("INVALID_TIMELINE_ORDER");
  const now = new Date().toISOString();
  const runtime = getRuntimeEnv();
  const existing = await db.select({ id: dayTimelinePositionRecords.id }).from(dayTimelinePositionRecords).where(and(eq(dayTimelinePositionRecords.tripId, input.tripId), eq(dayTimelinePositionRecords.dayId, input.dayId))).orderBy(asc(dayTimelinePositionRecords.sortOrder));
  const statements = existing.map((row, index) => runtime.DB.prepare("UPDATE day_timeline_positions SET sort_order = ?, updated_by_member_id = ?, updated_at = ? WHERE id = ?").bind(-100000 - index, input.actorMemberId, now, row.id));
  for (const [sortOrder, entry] of entries.entries()) {
    const sourceType = entry.source === "itinerary" ? "itinerary_item" : "booking_anchor";
    const type = anchorType(entry);
    statements.push(runtime.DB.prepare("INSERT INTO day_timeline_positions (id, trip_id, day_id, source_type, source_id, anchor_type, sort_order, created_by_member_id, updated_by_member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day_id, source_type, source_id, anchor_type) DO UPDATE SET sort_order = excluded.sort_order, updated_by_member_id = excluded.updated_by_member_id, updated_at = excluded.updated_at").bind(crypto.randomUUID(), input.tripId, input.dayId, sourceType, entry.sourceId, type, sortOrder, input.actorMemberId, input.actorMemberId, now, now));
  }
  if (statements.length) await runtime.DB.batch(statements);
  return getDayTimeline(input.tripId, input.dayId);
}

export async function listDayTimelinePositions(tripId: string, dayId: string) {
  return getDb().select().from(dayTimelinePositionRecords).where(and(eq(dayTimelinePositionRecords.tripId, tripId), eq(dayTimelinePositionRecords.dayId, dayId))).orderBy(asc(dayTimelinePositionRecords.sortOrder));
}
