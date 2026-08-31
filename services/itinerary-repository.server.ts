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
  durationMinutes?: number | null;
  sortOrder?: number;
  lockedAt?: string | null;
};

export async function createItineraryItem(input: CreateItineraryItemInput, actorMemberId: string) {
  if (!input.title.trim()) throw new Error("ITINERARY_TITLE_REQUIRED");
  assertLocalTime(input.startTimeLocal ?? null, "start_time");
  assertUtcInstant(input.lockedAt ?? null, "locked_at");
  if (input.durationMinutes != null && (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes < 0)) throw new Error("INVALID_DURATION");
  const db = getDb();
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
  await db.insert(itineraryItemRecords).values({ id, tripId: input.tripId, dayId: input.dayId, stageId: input.stageId ?? null, recommendationId: input.recommendationId ?? null, placeId: input.placeId ?? null, originPlaceId: input.originPlaceId ?? null, destinationPlaceId: input.destinationPlaceId ?? null, itemType: input.itemType, title: input.title.trim(), note: input.note ?? null, startTimeLocal: input.startTimeLocal ?? null, durationMinutes: input.durationMinutes ?? null, sortOrder, lockedAt: input.lockedAt ?? null, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now });
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
  const d1 = getRuntimeEnv().DB;
  const statements = [];
  for (const [index, id] of orderedItemIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(-(index + 1), new Date().toISOString(), id, dayId, tripId));
  for (const [index, id] of orderedItemIds.entries()) statements.push(d1.prepare("UPDATE itinerary_items SET sort_order = ?, updated_at = ? WHERE id = ? AND day_id = ? AND trip_id = ?").bind(index + 1, new Date().toISOString(), id, dayId, tripId));
  await d1.batch(statements);
  return listItineraryItems(dayId);
}

export async function deleteItineraryItem(id: string) {
  const deleted = await getDb().delete(itineraryItemRecords).where(eq(itineraryItemRecords.id, id)).returning({ id: itineraryItemRecords.id });
  return deleted.length > 0;
}

export async function setItineraryParticipantOverride(input: { itineraryItemId: string; memberId: string; participation: "included" | "excluded"; note?: string | null }) {
  const db = getDb();
  const item = (await db.select({ tripId: itineraryItemRecords.tripId }).from(itineraryItemRecords).where(eq(itineraryItemRecords.id, input.itineraryItemId)).limit(1))[0];
  if (!item) throw new Error("ITINERARY_ITEM_NOT_FOUND");
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, item.tripId), eq(tripMemberRecords.memberId, input.memberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
  const now = new Date().toISOString();
  await db.insert(itineraryItemParticipantOverrideRecords).values({ itineraryItemId: input.itineraryItemId, memberId: input.memberId, participation: input.participation, note: input.note ?? null, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: [itineraryItemParticipantOverrideRecords.itineraryItemId, itineraryItemParticipantOverrideRecords.memberId], set: { participation: input.participation, note: input.note ?? null, updatedAt: now } });
}
