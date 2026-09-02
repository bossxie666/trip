import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "../db/index.ts";
import { dayRecords, itineraryItemParticipantOverrideRecords, itineraryItemRecords, placeRecords, recommendationRecords, tripCityRecords, tripMemberRecords, tripStageRecords } from "../db/schema.ts";
import { assertLocalTime, assertUtcInstant } from "./planning-domain.mjs";
import type { ItineraryItemType } from "../models/planning.ts";

export type CreateItineraryItemInput = {
  tripId: string;
  dayId: string;
  stageId?: string | null;
  recommendationId?: string | null;
  placeId?: string | null;
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  itemType: ItineraryItemType;
  title: string;
  note?: string | null;
  startTimeLocal?: string | null;
  endTimeLocal?: string | null;
  timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours";
  openingHoursNote?: string | null;
  durationMinutes?: number | null;
  sortOrder?: number;
  lockedAt?: string | null;
};

export type UpdateItineraryItemInput = {
  title?: string;
  note?: string | null;
  placeId?: string | null;
  startTimeLocal?: string | null;
  endTimeLocal?: string | null;
  timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours";
  openingHoursNote?: string | null;
  durationMinutes?: number | null;
  dayId?: string;
};

async function assertTripMember(tripId: string, memberId: string) {
  if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
}

export async function createItineraryItem(input: CreateItineraryItemInput, actorMemberId: string) {
  if (!input.title.trim()) throw new Error("ITINERARY_TITLE_REQUIRED");
  assertLocalTime(input.startTimeLocal ?? null, "start_time");
  assertLocalTime(input.endTimeLocal ?? null, "end_time");
  assertUtcInstant(input.lockedAt ?? null, "locked_at");
  if (input.durationMinutes != null && (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes < 0)) throw new Error("INVALID_DURATION");
  const db = getDb();
  await assertTripMember(input.tripId, actorMemberId);
  const day = (await db.select().from(dayRecords).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, input.tripId))).limit(1))[0];
  if (!day) throw new Error("DAY_NOT_IN_TRIP");
  if (input.stageId && !(await db.select({ id: tripStageRecords.id }).from(tripStageRecords).where(and(eq(tripStageRecords.id, input.stageId), eq(tripStageRecords.tripId, input.tripId))).limit(1))[0]) throw new Error("STAGE_NOT_IN_TRIP");
  if (input.recommendationId && !(await db.select({ id: recommendationRecords.id }).from(recommendationRecords).where(and(eq(recommendationRecords.id, input.recommendationId), eq(recommendationRecords.tripId, input.tripId), isNull(recommendationRecords.deletedAt))).limit(1))[0]) throw new Error("RECOMMENDATION_NOT_IN_TRIP");
  const placeIds = [...new Set([input.placeId, input.originPlaceId, input.destinationPlaceId].filter((id): id is string => Boolean(id)))];
  if (placeIds.length) {
    const valid = await db.select({ id: placeRecords.id }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, input.tripId))).where(inArray(placeRecords.id, placeIds));
    if (valid.length !== placeIds.length) throw new Error("ITEM_PLACE_NOT_IN_TRIP_CITY");
  }
  const highest = (await db.select({ value: max(itineraryItemRecords.sortOrder) }).from(itineraryItemRecords).where(eq(itineraryItemRecords.dayId, input.dayId)))[0]?.value ?? 0;
  const sortOrder = input.sortOrder ?? highest + 1;
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 1) throw new Error("INVALID_SORT_ORDER");
  const now = new Date().toISOString(), id = crypto.randomUUID();
  const timeMode = input.timeMode || (input.startTimeLocal ? "start_only" : "untimed");
  if (timeMode === "range" && (!input.startTimeLocal || !input.endTimeLocal)) throw new Error("TIME_RANGE_REQUIRED");
  await db.insert(itineraryItemRecords).values({ id, tripId: input.tripId, dayId: input.dayId, stageId: input.stageId ?? null, recommendationId: input.recommendationId ?? null, placeId: input.placeId ?? null, originPlaceId: input.originPlaceId ?? null, destinationPlaceId: input.destinationPlaceId ?? null, itemType: input.itemType, title: input.title.trim(), note: input.note ?? null, startTimeLocal: input.startTimeLocal ?? null, endTimeLocal: input.endTimeLocal ?? null, timeMode, openingHoursNote: input.openingHoursNote ?? null, durationMinutes: input.durationMinutes ?? null, sortOrder, lockedAt: input.lockedAt ?? null, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now });
  return (await db.select().from(itineraryItemRecords).where(eq(itineraryItemRecords.id, id)).limit(1))[0];
}

export async function listItineraryItems(dayId: string) {
  return getDb().select().from(itineraryItemRecords).where(eq(itineraryItemRecords.dayId, dayId)).orderBy(asc(itineraryItemRecords.sortOrder), asc(itineraryItemRecords.id));
}

export async function reorderItineraryItems(tripId: string, dayId: string, orderedItemIds: string[]) {
  if (!orderedItemIds.length || new Set(orderedItemIds).size !== orderedItemIds.length) throw new Error("INVALID_ORDER");
  const db = getDb();
  if (!(await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, dayId), eq(dayRecords.tripId, tripId))).limit(1))[0]) throw new Error("DAY_NOT_IN_TRIP");
  const current = await db.select({ id: itineraryItemRecords.id }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.dayId, dayId), eq(itineraryItemRecords.tripId, tripId)));
  const currentIds = current.map((item) => item.id).sort(), requestedIds = [...orderedItemIds].sort();
  if (currentIds.length !== requestedIds.length || currentIds.some((id, index) => id !== requestedIds[index])) throw new Error("INVALID_ORDER");
  const allItems = await db.select({ id: itineraryItemRecords.id, lockedAt: itineraryItemRecords.lockedAt }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.dayId, dayId), eq(itineraryItemRecords.tripId, tripId)));
  if (allItems.some((item) => item.lockedAt != null)) throw new Error("ITINERARY_ITEM_LOCKED");
  const d1 = getRuntimeEnv().DB;
  const statements = [];
  for (const [index, id] of orderedItemIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(-(index + 1), new Date().toISOString(), id, dayId, tripId));
  for (const [index, id] of orderedItemIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(index + 1, new Date().toISOString(), id, dayId, tripId));
  await d1.batch(statements);
  return listItineraryItems(dayId);
}

export async function updateItineraryItem(tripId: string, id: string, input: UpdateItineraryItemInput, actorMemberId: string) {
  const db = getDb();
  await assertTripMember(tripId, actorMemberId);
  const item = (await db.select().from(itineraryItemRecords).where(and(eq(itineraryItemRecords.id, id), eq(itineraryItemRecords.tripId, tripId))).limit(1))[0];
  if (!item) throw new Error("ITINERARY_ITEM_NOT_FOUND");
  const title = input.title === undefined ? item.title : input.title.trim();
  if (!title) throw new Error("ITINERARY_TITLE_REQUIRED");
  const startTimeLocal = input.startTimeLocal === undefined ? item.startTimeLocal : input.startTimeLocal;
  const endTimeLocal = input.endTimeLocal === undefined ? item.endTimeLocal : input.endTimeLocal;
  const timeMode = input.timeMode === undefined ? item.timeMode : input.timeMode;
  const openingHoursNote = input.openingHoursNote === undefined ? item.openingHoursNote : input.openingHoursNote;
  const durationMinutes = input.durationMinutes === undefined ? item.durationMinutes : input.durationMinutes;
  const nextPlaceId = input.placeId === undefined ? item.placeId : input.placeId;
  assertLocalTime(startTimeLocal, "start_time");
  assertLocalTime(endTimeLocal, "end_time");
  if (timeMode === "range" && (!startTimeLocal || !endTimeLocal)) throw new Error("TIME_RANGE_REQUIRED");
  if (durationMinutes != null && (!Number.isSafeInteger(durationMinutes) || durationMinutes < 0)) throw new Error("INVALID_DURATION");
  if (nextPlaceId) {
    const validPlace = await db.select({ id: placeRecords.id }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, tripId))).where(eq(placeRecords.id, nextPlaceId)).limit(1);
    if (!validPlace.length) throw new Error("ITEM_PLACE_NOT_IN_TRIP_CITY");
  }
  const targetDayId = input.dayId ?? item.dayId;
  if (!(await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, targetDayId), eq(dayRecords.tripId, tripId))).limit(1))[0]) throw new Error("DAY_NOT_IN_TRIP");
  const now = new Date().toISOString(), note = input.note === undefined ? item.note : input.note;
  if (targetDayId === item.dayId) {
    await db.update(itineraryItemRecords).set({ title, note, placeId: nextPlaceId, startTimeLocal, endTimeLocal, timeMode, openingHoursNote, durationMinutes, updatedByMemberId: actorMemberId, updatedAt: now }).where(and(eq(itineraryItemRecords.id, id), eq(itineraryItemRecords.tripId, tripId)));
  } else {
    if (item.lockedAt != null) throw new Error("ITINERARY_ITEM_LOCKED");
    const [sourceItems, targetHighest] = await Promise.all([
      db.select({ id: itineraryItemRecords.id }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, tripId), eq(itineraryItemRecords.dayId, item.dayId))).orderBy(asc(itineraryItemRecords.sortOrder), asc(itineraryItemRecords.id)),
      db.select({ value: max(itineraryItemRecords.sortOrder) }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, tripId), eq(itineraryItemRecords.dayId, targetDayId))),
    ]);
    const remainingIds = sourceItems.map((row) => row.id).filter((itemId) => itemId !== id), targetSortOrder = (targetHighest[0]?.value ?? 0) + 1;
    const d1 = getRuntimeEnv().DB, statements = [d1.prepare("UPDATE itinerary_items SET day_id = ?, sort_order = ?, title = ?, note = ?, place_id = ?, start_time_local = ?, end_time_local = ?, time_mode = ?, opening_hours_note = ?, duration_minutes = ?, updated_by_member_id = ?, updated_at = ? WHERE id = ? AND trip_id = ?").bind(targetDayId, targetSortOrder, title, note, nextPlaceId, startTimeLocal, endTimeLocal, timeMode, openingHoursNote, durationMinutes, actorMemberId, now, id, tripId)];
    for (const [index, itemId] of remainingIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(-(index + 1), now, itemId, item.dayId, tripId));
    for (const [index, itemId] of remainingIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(index + 1, now, itemId, item.dayId, tripId));
    await d1.batch(statements);
  }
  return (await db.select().from(itineraryItemRecords).where(eq(itineraryItemRecords.id, id)).limit(1))[0];
}

export async function deleteItineraryItem(tripId: string, id: string) {
  const db = getDb();
  const item = (await db.select().from(itineraryItemRecords).where(and(eq(itineraryItemRecords.id, id), eq(itineraryItemRecords.tripId, tripId))).limit(1))[0];
  if (!item) throw new Error("ITINERARY_ITEM_NOT_FOUND");
  const remaining = await db.select({ id: itineraryItemRecords.id }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, tripId), eq(itineraryItemRecords.dayId, item.dayId))).orderBy(asc(itineraryItemRecords.sortOrder), asc(itineraryItemRecords.id));
  const remainingIds = remaining.map((row) => row.id).filter((itemId) => itemId !== id), now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
  const statements = [d1.prepare("DELETE FROM itinerary_items WHERE id = ? AND trip_id = ?").bind(id, tripId)];
  for (const [index, itemId] of remainingIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(-(index + 1), now, itemId, item.dayId, tripId));
  for (const [index, itemId] of remainingIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(index + 1, now, itemId, item.dayId, tripId));
  await d1.batch(statements);
  return true;
}

export async function setItineraryParticipantOverride(input: { itineraryItemId: string; memberId: string; participation: "included" | "excluded"; note?: string | null }) {
  const db = getDb();
  const item = (await db.select({ tripId: itineraryItemRecords.tripId }).from(itineraryItemRecords).where(eq(itineraryItemRecords.id, input.itineraryItemId)).limit(1))[0];
  if (!item) throw new Error("ITINERARY_ITEM_NOT_FOUND");
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, item.tripId), eq(tripMemberRecords.memberId, input.memberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
  const now = new Date().toISOString();
  await db.insert(itineraryItemParticipantOverrideRecords).values({ itineraryItemId: input.itineraryItemId, memberId: input.memberId, participation: input.participation, note: input.note ?? null, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: [itineraryItemParticipantOverrideRecords.itineraryItemId, itineraryItemParticipantOverrideRecords.memberId], set: { participation: input.participation, note: input.note ?? null, updatedAt: now } });
}

/**
 * Replace the explicit participant override set for one itinerary item.
 * `null` clears the set and returns the item to day-level presence inference.
 * Every member is written when an explicit set is requested so that an
 * unchecked member is an intentional exclusion, not an unknown value.
 */
export async function replaceItineraryParticipantOverrides(input: { tripId: string; itineraryItemId: string; memberIds: string[] | null; actorMemberId: string }) {
  const db = getDb();
  await assertTripMember(input.tripId, input.actorMemberId);
  const item = (await db.select({ tripId: itineraryItemRecords.tripId }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.id, input.itineraryItemId), eq(itineraryItemRecords.tripId, input.tripId))).limit(1))[0];
  if (!item) throw new Error("ITINERARY_ITEM_NOT_FOUND");
  if (input.memberIds === null) {
    await db.delete(itineraryItemParticipantOverrideRecords).where(eq(itineraryItemParticipantOverrideRecords.itineraryItemId, input.itineraryItemId));
    return [];
  }
  const members = await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(eq(tripMemberRecords.tripId, input.tripId));
  const memberSet = new Set(members.map((member) => member.memberId));
  const selected = new Set(input.memberIds.map(String));
  if ([...selected].some((memberId) => !memberSet.has(memberId))) throw new Error("MEMBER_NOT_IN_TRIP");
  const now = new Date().toISOString();
  const d1 = getRuntimeEnv().DB;
  const statements = [d1.prepare("DELETE FROM itinerary_item_participant_overrides WHERE itinerary_item_id = ?").bind(input.itineraryItemId)];
  for (const member of members) {
    statements.push(d1.prepare("INSERT INTO itinerary_item_participant_overrides (itinerary_item_id, member_id, participation, note, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)").bind(input.itineraryItemId, member.memberId, selected.has(member.memberId) ? "included" : "excluded", now, now));
  }
  await d1.batch(statements);
  return db.select().from(itineraryItemParticipantOverrideRecords).where(eq(itineraryItemParticipantOverrideRecords.itineraryItemId, input.itineraryItemId));
}
