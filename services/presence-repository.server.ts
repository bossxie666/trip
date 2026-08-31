import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { itineraryItemParticipantOverrideRecords, itineraryItemRecords, memberPresenceWindowRecords, tripMemberRecords, tripStageRecords } from "../db/schema.ts";
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
