import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { placeRecords, recommendationMemberStateRecords, recommendationPlaceOptionRecords, recommendationRecords, tripCityRecords, tripMemberRecords, tripRecords } from "../db/schema.ts";
import { assertCurrency, assertMinorAmount } from "./planning-domain.mjs";
import type { RecommendationCategory, RecommendationKind, RecommendationPlaceRelation } from "../models/planning.ts";

export type CreateRecommendationInput = {
  tripId: string;
  kind: RecommendationKind;
  category: RecommendationCategory;
  title: string;
  summary?: string | null;
  areaLabel?: string | null;
  areaKey?: string | null;
  isCore?: boolean;
  estimatedDurationMinutes?: number | null;
  estimatedCostMinor?: number | null;
  costBasis?: string | null;
  priceMinMinor?: number | null;
  priceMaxMinor?: number | null;
  priceCurrency?: string | null;
  priceBasis?: "per_person" | "per_group" | "per_item" | "free" | "unknown" | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  coverImageUrl?: string | null;
};

export async function createRecommendation(input: CreateRecommendationInput, actorMemberId: string) {
  if (!input.title.trim()) throw new Error("RECOMMENDATION_TITLE_REQUIRED");
  if (input.estimatedDurationMinutes != null && (!Number.isSafeInteger(input.estimatedDurationMinutes) || input.estimatedDurationMinutes < 0)) throw new Error("INVALID_DURATION");
  if (input.estimatedCostMinor != null) assertMinorAmount(input.estimatedCostMinor, "estimated_cost");
  if (input.priceMinMinor != null) assertMinorAmount(input.priceMinMinor, "price_min");
  if (input.priceMaxMinor != null) assertMinorAmount(input.priceMaxMinor, "price_max");
  if (input.priceMinMinor != null && input.priceMaxMinor != null && input.priceMaxMinor < input.priceMinMinor) throw new Error("INVALID_PRICE_RANGE");
  if ((input.priceMinMinor != null || input.priceMaxMinor != null) && !input.priceCurrency) throw new Error("PRICE_CURRENCY_REQUIRED");
  if (input.priceCurrency != null) assertCurrency(input.priceCurrency);
  if (input.priceBasis != null && !["per_person", "per_group", "per_item", "free", "unknown"].includes(input.priceBasis)) throw new Error("INVALID_PRICE_BASIS");
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.id, input.tripId)).limit(1))[0];
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  const now = new Date().toISOString();
  const record = { id: crypto.randomUUID(), ...input, title: input.title.trim(), isCore: input.isCore ?? false, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now, deletedAt: null };
  await db.insert(recommendationRecords).values(record);
  return record;
}

export async function listRecommendations(tripId: string) {
  return getDb().select().from(recommendationRecords).where(and(eq(recommendationRecords.tripId, tripId), isNull(recommendationRecords.deletedAt))).orderBy(asc(recommendationRecords.createdAt));
}

export async function softDeleteRecommendation(id: string, actorMemberId: string) {
  const now = new Date().toISOString();
  const result = await getDb().update(recommendationRecords).set({ deletedAt: now, updatedAt: now, updatedByMemberId: actorMemberId }).where(and(eq(recommendationRecords.id, id), isNull(recommendationRecords.deletedAt))).returning({ id: recommendationRecords.id });
  return result.length > 0;
}

export async function addRecommendationPlaceOption(input: { recommendationId: string; placeId: string; relationType: RecommendationPlaceRelation; optionGroupKey?: string | null; isPrimary?: boolean; sortOrder: number; note?: string | null }) {
  if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0) throw new Error("INVALID_SORT_ORDER");
  const db = getDb();
  const recommendation = (await db.select().from(recommendationRecords).where(and(eq(recommendationRecords.id, input.recommendationId), isNull(recommendationRecords.deletedAt))).limit(1))[0];
  if (!recommendation) throw new Error("RECOMMENDATION_NOT_FOUND");
  const allowedPlace = (await db.select({ id: placeRecords.id }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, recommendation.tripId))).where(eq(placeRecords.id, input.placeId)).limit(1))[0];
  if (!allowedPlace) throw new Error("PLACE_NOT_IN_TRIP_CITY");
  const now = new Date().toISOString();
  const record = { id: crypto.randomUUID(), ...input, optionGroupKey: input.optionGroupKey ?? null, isPrimary: input.isPrimary ?? false, note: input.note ?? null, createdAt: now, updatedAt: now };
  await db.insert(recommendationPlaceOptionRecords).values(record);
  return record;
}

export async function removeRecommendationPlaceOption(id: string) {
  const deleted = await getDb().delete(recommendationPlaceOptionRecords).where(eq(recommendationPlaceOptionRecords.id, id)).returning({ id: recommendationPlaceOptionRecords.id });
  return deleted.length > 0;
}

export async function setRecommendationFavorite(recommendationId: string, memberId: string, isFavorite: boolean) {
  const db = getDb();
  const recommendation = (await db.select({ tripId: recommendationRecords.tripId }).from(recommendationRecords).where(and(eq(recommendationRecords.id, recommendationId), isNull(recommendationRecords.deletedAt))).limit(1))[0];
  if (!recommendation) throw new Error("RECOMMENDATION_NOT_FOUND");
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, recommendation.tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0]) throw new Error("MEMBER_NOT_IN_TRIP");
  await db.insert(recommendationMemberStateRecords).values({ recommendationId, memberId, isFavorite, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: [recommendationMemberStateRecords.recommendationId, recommendationMemberStateRecords.memberId], set: { isFavorite, updatedAt: new Date().toISOString() } });
}
