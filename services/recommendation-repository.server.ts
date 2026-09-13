import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "../db/index.ts";
import { mediaAssetRecords, placeRecords, recommendationMemberStateRecords, recommendationPlaceOptionRecords, recommendationRecords, recommendationReferenceMediaRecords, recommendationReferenceRecords, tripCityRecords, tripMemberRecords, tripRecords } from "../db/schema.ts";
import { assertCurrency, assertMinorAmount } from "./planning-domain.mjs";
import type { RecommendationCategory, RecommendationKind, RecommendationPlaceRelation } from "../models/planning.ts";

export type CreateRecommendationInput = {
  tripId: string;
  kind: RecommendationKind;
  guideType?: "day_trip" | null;
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

function validateRecommendationInput(input: CreateRecommendationInput) {
  if (!input.title.trim()) throw new Error("RECOMMENDATION_TITLE_REQUIRED");
  if (!['place', 'guide'].includes(input.kind)) throw new Error("INVALID_RECOMMENDATION_KIND");
  // Legacy categories remain accepted at the repository boundary for import
  // and historical-data compatibility. New member-facing authoring routes
  // expose only attraction/food/shopping/other.
  if (!["attraction", "food", "cafe", "shopping", "hotel", "experience", "other"].includes(input.category)) throw new Error("INVALID_RECOMMENDATION_CATEGORY");
  if (input.guideType != null && (input.kind !== "guide" || input.guideType !== "day_trip")) throw new Error("INVALID_GUIDE_TYPE");
  if (input.kind === "guide" && (input.estimatedCostMinor != null || input.priceMinMinor != null || input.priceMaxMinor != null)) throw new Error("GUIDE_FORMAL_ESTIMATE_NOT_ALLOWED");
  if (input.estimatedDurationMinutes != null && (!Number.isSafeInteger(input.estimatedDurationMinutes) || input.estimatedDurationMinutes < 0)) throw new Error("INVALID_DURATION");
  if (input.estimatedCostMinor != null) assertMinorAmount(input.estimatedCostMinor, "estimated_cost");
  if (input.priceMinMinor != null) assertMinorAmount(input.priceMinMinor, "price_min");
  if (input.priceMaxMinor != null) assertMinorAmount(input.priceMaxMinor, "price_max");
  if (input.priceMinMinor != null && input.priceMaxMinor != null && input.priceMaxMinor < input.priceMinMinor) throw new Error("INVALID_PRICE_RANGE");
  if ((input.priceMinMinor != null || input.priceMaxMinor != null) && !input.priceCurrency) throw new Error("PRICE_CURRENCY_REQUIRED");
  if (input.priceCurrency != null) assertCurrency(input.priceCurrency);
  if (input.priceBasis != null && !["per_person", "per_group", "per_item", "free", "unknown"].includes(input.priceBasis)) throw new Error("INVALID_PRICE_BASIS");
}

export async function createRecommendation(input: CreateRecommendationInput, actorMemberId: string) {
  validateRecommendationInput(input);
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.id, input.tripId)).limit(1))[0];
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  const now = new Date().toISOString();
  const record = { id: crypto.randomUUID(), ...input, title: input.title.trim(), isCore: input.isCore ?? false, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now, deletedAt: null };
  await db.insert(recommendationRecords).values(record);
  return record;
}

export async function getRecommendationDetail(tripId: string, id: string) {
  const db = getDb();
  const recommendation = (await db.select().from(recommendationRecords).where(and(eq(recommendationRecords.id, id), eq(recommendationRecords.tripId, tripId), isNull(recommendationRecords.deletedAt))).limit(1))[0];
  if (!recommendation) return null;
  const [options, references] = await Promise.all([
    db.select({ option: recommendationPlaceOptionRecords, place: placeRecords }).from(recommendationPlaceOptionRecords).innerJoin(placeRecords, eq(placeRecords.id, recommendationPlaceOptionRecords.placeId)).where(eq(recommendationPlaceOptionRecords.recommendationId, id)).orderBy(asc(recommendationPlaceOptionRecords.sortOrder)),
    db.select().from(recommendationReferenceRecords).where(eq(recommendationReferenceRecords.recommendationId, id)).orderBy(asc(recommendationReferenceRecords.sortOrder)),
  ]);
  const referenceMedia = references.length ? await db.select({ referenceId: recommendationReferenceMediaRecords.referenceId, mediaAssetId: recommendationReferenceMediaRecords.mediaAssetId })
    .from(recommendationReferenceMediaRecords)
    .innerJoin(mediaAssetRecords, and(eq(mediaAssetRecords.id, recommendationReferenceMediaRecords.mediaAssetId), eq(mediaAssetRecords.status, "ready")))
    .where(inArray(recommendationReferenceMediaRecords.referenceId, references.map((reference) => reference.id)))
    .orderBy(asc(recommendationReferenceMediaRecords.sortOrder)) : [];
  return { recommendation, options, references: references.map((reference) => ({
    ...reference,
    imageUrls: [
      ...parseImageUrls(reference.imageUrlsJson),
      ...referenceMedia.filter((item) => item.referenceId === reference.id).map((item) => `/api/media/${encodeURIComponent(item.mediaAssetId)}?variant=display`),
    ],
  })) };
}

function parseImageUrls(value: string | null) {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}

export async function addRecommendationReference(input: { recommendationId: string; platform: "official" | "xiaohongshu" | "web" | "manual"; authorLabel?: string | null; title?: string | null; sourceUrl: string; imageUrls?: string[]; note?: string | null; sortOrder?: number; actorMemberId?: string | null }) {
  if (!input.sourceUrl.trim()) throw new Error("REFERENCE_URL_REQUIRED");
  const now = new Date().toISOString();
  const record = { id: crypto.randomUUID(), recommendationId: input.recommendationId, platform: input.platform, authorLabel: input.authorLabel ?? null, title: input.title ?? null, sourceUrl: input.sourceUrl.trim(), imageUrlsJson: input.imageUrls?.length ? JSON.stringify(input.imageUrls) : null, note: input.note ?? null, sortOrder: input.sortOrder ?? 0, createdByMemberId: input.actorMemberId ?? null, updatedByMemberId: input.actorMemberId ?? null, createdAt: now, updatedAt: now };
  await getDb().insert(recommendationReferenceRecords).values(record);
  return record;
}

export async function createMemberRecommendation(input: CreateRecommendationInput & {
  placeIds: string[];
  reference?: { platform: "official" | "xiaohongshu" | "web" | "manual"; authorLabel?: string | null; title?: string | null; sourceUrl: string; imageUrls?: string[]; note?: string | null; mediaAssetIds?: string[] } | null;
}, actorMemberId: string) {
  validateRecommendationInput({ ...input, isCore: false });
  const placeIds = [...new Set(input.placeIds.map(String).filter(Boolean))];
  if (input.kind === "place" && placeIds.length !== 1) throw new Error("PLACE_REQUIRED");
  if (input.kind === "guide" && !placeIds.length) throw new Error("GUIDE_COMPONENT_REQUIRED");
  const db = getDb();
  const allowedPlaces = await db.select({ id: placeRecords.id }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, input.tripId))).where(inArray(placeRecords.id, placeIds));
  if (allowedPlaces.length !== placeIds.length) throw new Error("PLACE_NOT_IN_TRIP_CITY");
  const mediaAssetIds = [...new Set((input.reference?.mediaAssetIds || []).map(String).filter(Boolean))];
  if (mediaAssetIds.length > 5) throw new Error("INVALID_REFERENCE_MEDIA");
  if (mediaAssetIds.length) {
    const media = await db.select({ id: mediaAssetRecords.id }).from(mediaAssetRecords).where(and(inArray(mediaAssetRecords.id, mediaAssetIds), eq(mediaAssetRecords.uploaderMemberId, actorMemberId), eq(mediaAssetRecords.purpose, "recommendation_reference"), eq(mediaAssetRecords.status, "ready")));
    if (media.length !== mediaAssetIds.length) throw new Error("INVALID_REFERENCE_MEDIA");
  }
  if (input.reference && !input.reference.sourceUrl.trim()) throw new Error("REFERENCE_URL_REQUIRED");
  const recommendationId = crypto.randomUUID(), referenceId = input.reference ? crypto.randomUUID() : null, now = new Date().toISOString();
  const env = getRuntimeEnv();
  const statements = [
    env.DB.prepare("INSERT INTO recommendations (id, trip_id, kind, guide_type, category, title, summary, area_label, area_key, is_core, estimated_duration_minutes, estimated_cost_minor, cost_basis, price_min_minor, price_max_minor, price_currency, price_basis, source_label, source_url, cover_image_url, created_by_member_id, updated_by_member_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)").bind(recommendationId, input.tripId, input.kind, input.guideType ?? null, input.category, input.title.trim(), input.summary ?? null, input.areaLabel ?? null, input.areaKey ?? null, input.estimatedDurationMinutes ?? null, input.kind === "place" ? input.priceMinMinor ?? null : null, input.kind === "place" ? input.priceMaxMinor ?? null : null, input.kind === "place" ? input.priceCurrency ?? null : null, input.kind === "place" ? input.priceBasis ?? null : null, input.sourceLabel ?? null, input.sourceUrl ?? null, input.coverImageUrl ?? null, actorMemberId, actorMemberId, now, now),
    ...placeIds.map((placeId, sortOrder) => env.DB.prepare("INSERT INTO recommendation_place_options (id, recommendation_id, place_id, relation_type, option_group_key, is_primary, sort_order, note, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)").bind(crypto.randomUUID(), recommendationId, placeId, input.kind === "guide" ? "component" : "alternative", input.kind === "place" && sortOrder === 0 ? 1 : 0, sortOrder, now, now)),
  ];
  if (input.reference && referenceId) {
    statements.push(env.DB.prepare("INSERT INTO recommendation_references (id, recommendation_id, platform, author_label, title, source_url, image_urls_json, note, sort_order, created_by_member_id, updated_by_member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)").bind(referenceId, recommendationId, input.reference.platform, input.reference.authorLabel?.trim() || null, input.reference.title?.trim() || null, input.reference.sourceUrl.trim(), input.reference.imageUrls?.length ? JSON.stringify(input.reference.imageUrls.slice(0, 5)) : null, input.reference.note?.trim() || null, actorMemberId, actorMemberId, now, now));
    statements.push(...mediaAssetIds.map((mediaAssetId, sortOrder) => env.DB.prepare("INSERT INTO recommendation_reference_media (reference_id, media_asset_id, sort_order) VALUES (?, ?, ?)").bind(referenceId, mediaAssetId, sortOrder)));
  }
  await env.DB.batch(statements);
  return { id: recommendationId, referenceId, title: input.title.trim(), kind: input.kind, isCore: false };
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
