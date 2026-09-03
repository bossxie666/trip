import { and, asc, eq } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "../db/index.ts";
import { dayPresenceRecords, dayRecords, itineraryItemParticipantOverrideRecords, itineraryItemRecords, memberPresenceWindowRecords, tripMemberRecords, tripRecords, tripStageRecords } from "../db/schema.ts";
import { assertNoPresenceOverlap, assertTimezone, assertUtcInstant, resolvePresence } from "./planning-domain.mjs";
import type { PresenceCoverage, PresenceState } from "../models/planning.ts";

export async function createPresenceWindow(input: { tripId: string; memberId: string; stageId?: string | null; startsAt: string; endsAt?: string | null; timezone: string; note?: string | null }, actorMemberId: string) {
  assertUtcInstant(input.startsAt, "starts_at"); assertUtcInstant(input.endsAt ?? null, "ends_at"); assertTimezone(input.timezone);
  const db = getDb();
  const membership = (await db.select().from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, input.tripId), eq(tripMemberRecords.memberId, input.memberId))).limit(1))[0];
  if (!membership) throw new Error("MEMBER_NOT_IN_TRIP");
  if (input.stageId && !(await db.select({ id: tripStageRecords.id }).from(tripStageRecords).where(and(eq(tripStageRecords.id, input.stageId), eq(tripStageRecords.tripId, input.tripId))).limit(1))[0]) throw new Error("STAGE_NOT_IN_TRIP");
  const existing = await db.select({ id: memberPresenceWindowRecords.id, startsAt: memberPresenceWindowRecords.startsAt, endsAt: memberPresenceWindowRecords.endsAt }).from(memberPresenceWindowRecords).where(and(eq(memberPresenceWindowRecords.tripId, input.tripId), eq(memberPresenceWindowRecords.memberId, input.memberId)));
  assertNoPresenceOverlap(existing, { startsAt: input.startsAt, endsAt: input.endsAt ?? null });
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await db.insert(memberPresenceWindowRecords).values({ id, ...input, stageId: input.stageId ?? null, endsAt: input.endsAt ?? null, note: input.note ?? null, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now });
  return id;
}

export async function setPresenceCoverage(tripId: string, memberId: string, coverage: PresenceCoverage) {
  const changed = await getDb().update(tripMemberRecords).set({ presenceCoverage: coverage }).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, memberId))).returning({ memberId: tripMemberRecords.memberId });
  if (!changed.length) throw new Error("MEMBER_NOT_IN_TRIP");
}

export async function getPresenceState(tripId: string, memberId: string, at: string): Promise<PresenceState> {
  assertUtcInstant(at, "presence_instant");
  const db = getDb();
  const membership = (await db.select({ coverage: tripMemberRecords.presenceCoverage }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0];
  if (!membership) return "unknown";
  const point = Date.parse(at);
  const explicit = await db.select({ state: dayPresenceRecords.state, startsAt: dayPresenceRecords.startsAt, endsAt: dayPresenceRecords.endsAt, dayDate: dayRecords.date, timezone: tripRecords.timezone }).from(dayPresenceRecords).innerJoin(dayRecords, eq(dayRecords.id, dayPresenceRecords.dayId)).innerJoin(tripRecords, eq(tripRecords.id, dayPresenceRecords.tripId)).where(and(eq(dayPresenceRecords.tripId, tripId), eq(dayPresenceRecords.memberId, memberId)));
  if (Number.isFinite(point)) {
    const explicitState = explicit.find((entry) => {
      if (!entry.dayDate) return false;
      const offset = entry.timezone === "Asia/Shanghai" ? "+08:00" : entry.timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
      const dayStart = new Date(`${entry.dayDate}T00:00:00${offset}`).getTime();
      return point >= dayStart && point < dayStart + 86_400_000;
    });
    if (explicitState) {
      if (explicitState.state === "present") return "present";
      if (explicitState.state === "absent") return "absent";
      const offset = explicitState.timezone === "Asia/Shanghai" ? "+08:00" : explicitState.timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
      const dayStart = explicitState.dayDate ? new Date(`${explicitState.dayDate}T00:00:00${offset}`).getTime() : Number.NaN;
      const starts = explicitState.startsAt ? Date.parse(explicitState.startsAt) : dayStart;
      const ends = explicitState.endsAt ? Date.parse(explicitState.endsAt) : dayStart + 86_400_000;
      return Number.isFinite(starts) && Number.isFinite(ends) && starts <= point && point < ends ? "present" : "absent";
    }
  }
  const windows = await db.select({ id: memberPresenceWindowRecords.id, startsAt: memberPresenceWindowRecords.startsAt, endsAt: memberPresenceWindowRecords.endsAt }).from(memberPresenceWindowRecords).where(and(eq(memberPresenceWindowRecords.tripId, tripId), eq(memberPresenceWindowRecords.memberId, memberId))).orderBy(asc(memberPresenceWindowRecords.startsAt));
  return resolvePresence(windows, at, membership.coverage);
}

export async function resolveItineraryParticipants(itineraryItemId: string, at: string | null) {
  const db = getDb();
  const item = (await db.select({ tripId: itineraryItemRecords.tripId }).from(itineraryItemRecords).where(eq(itineraryItemRecords.id, itineraryItemId)).limit(1))[0];
  if (!item) throw new Error("ITINERARY_ITEM_NOT_FOUND");
  if (at) assertUtcInstant(at, "participant_instant");
  const [members, overrides] = await Promise.all([
    db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(eq(tripMemberRecords.tripId, item.tripId)),
    db.select().from(itineraryItemParticipantOverrideRecords).where(eq(itineraryItemParticipantOverrideRecords.itineraryItemId, itineraryItemId)),
  ]);
  const results = [];
  for (const member of members) {
    const override = overrides.find((entry) => entry.memberId === member.memberId);
    const state: PresenceState = override ? (override.participation === "included" ? "present" : "absent") : at ? await getPresenceState(item.tripId, member.memberId, at) : "unknown";
    results.push({ memberId: member.memberId, state, source: override ? "override" as const : at ? "presence" as const : "incomplete" as const });
  }
  return results;
}

function localDayBounds(date: string, timezone: string) {
  // Current trips use Asia/Shanghai. Keep a small explicit fallback for other
  // trips rather than silently treating a missing timezone as local time.
  const offset = timezone === "Asia/Shanghai" ? "+08:00" : timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
  const start = new Date(`${date}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Confirm one day's presence in a single, explicit operation. Selected
 * members receive an all-day window; unselected members are marked complete
 * with no window, which resolves them as absent for that day. Existing
 * non-day-aligned windows are left intact and cause an overlap error instead
 * of being silently destroyed.
 */
export type DayPresenceUpdate = { memberId: string; state: "present" | "absent" | "partial"; startsAt?: string | null; endsAt?: string | null };

function localTimeToUtc(dayDate: string, localTime: string | null | undefined, timezone: string, fallback: "start" | "end") {
  if (!localTime) return new Date(`${dayDate}T${fallback === "start" ? "00:00" : "23:59"}:00${timezone === "Asia/Shanghai" ? "+08:00" : timezone === "Asia/Tokyo" ? "+09:00" : "+00:00"}`).toISOString();
  if (/Z$/.test(localTime)) return new Date(localTime).toISOString();
  if (!/^\d{2}:\d{2}$/.test(localTime)) throw new Error("INVALID_PRESENCE_TIME");
  return new Date(`${dayDate}T${localTime}:00${timezone === "Asia/Shanghai" ? "+08:00" : timezone === "Asia/Tokyo" ? "+09:00" : "+00:00"}`).toISOString();
}

export async function replaceDayPresence(input: { tripId: string; dayId: string; memberIds?: string[]; members?: DayPresenceUpdate[]; actorMemberId: string }) {
  const db = getDb();
  await (async () => {
    if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, input.tripId), eq(tripMemberRecords.memberId, input.actorMemberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
  })();
  const day = (await db.select({ date: dayRecords.date, timezone: tripRecords.timezone }).from(dayRecords).innerJoin(tripRecords, eq(tripRecords.id, dayRecords.tripId)).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, input.tripId))).limit(1))[0];
  if (!day?.date) throw new Error("DAY_CONTEXT_INCOMPLETE");
  // Older and newly-created Trips may have a nullable timezone.  Presence
  // confirmation is still a local-calendar operation; use the product's
  // default timezone instead of misreporting the missing metadata as an
  // incomplete presence interval.
  const timezone = day.timezone || "Asia/Shanghai";
  const members = await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(eq(tripMemberRecords.tripId, input.tripId));
  const memberSet = new Set(members.map((member) => member.memberId));
  const legacySelected = new Set((input.memberIds || []).map(String));
  const updates: DayPresenceUpdate[] = input.members?.length ? input.members.map((entry) => ({ memberId: String(entry.memberId), state: entry.state, startsAt: entry.startsAt ?? null, endsAt: entry.endsAt ?? null })) : members.map((member) => ({ memberId: member.memberId, state: legacySelected.has(member.memberId) ? "present" as const : "absent" as const }));
  if (updates.length !== members.length || new Set(updates.map((entry) => entry.memberId)).size !== members.length || updates.some((entry) => !memberSet.has(entry.memberId) || !["present", "absent", "partial"].includes(entry.state))) throw new Error("INVALID_PRESENCE_STATE");
  const { start, end } = localDayBounds(day.date, timezone);
  const now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
  const statements = [] as D1PreparedStatement[];
  for (const update of updates) {
    let startsAt: string | null = null, endsAt: string | null = null;
    if (update.state === "present") { startsAt = start; endsAt = end; }
    if (update.state === "partial") {
      // A partial-presence record is the only state that requires an
      // interval. Present/absent deliberately clear any stale interval.
      if (!update.startsAt || !update.endsAt) throw new Error(`INCOMPLETE_PRESENCE:${update.memberId}`);
      startsAt = localTimeToUtc(day.date, update.startsAt, timezone, "start");
      endsAt = localTimeToUtc(day.date, update.endsAt, timezone, "end");
      if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("INVALID_PRESENCE_RANGE");
    }
    statements.push(d1.prepare("INSERT INTO day_member_presence (id, trip_id, day_id, member_id, state, starts_at, ends_at, created_by_member_id, updated_by_member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day_id, member_id) DO UPDATE SET state = excluded.state, starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_by_member_id = excluded.updated_by_member_id, updated_at = excluded.updated_at").bind(crypto.randomUUID(), input.tripId, input.dayId, update.memberId, update.state, startsAt, endsAt, input.actorMemberId, input.actorMemberId, now, now));
  }
  await d1.batch(statements);
  return { dayId: input.dayId, members: updates, startsAt: start, endsAt: end };
}
