import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { recommendationRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { addRecommendationPlaceOption, createMemberRecommendation, createRecommendation } from "@/services/recommendation-repository.server";
import { createAmapPlace } from "@/services/place-repository.server";
import type { RecommendationCategory } from "@/models/planning";

const categories = new Set(["attraction", "food", "shopping", "other"]);
type PlaceInput = { placeId?: string | null; providerPlaceId?: string | null; cityId?: string | null };

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const { slug } = await params;
    const db = getDb();
    const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const body = await request.json() as { kind?: "place" | "guide"; guideType?: "day_trip" | null; title?: string; placeId?: string; providerPlaceId?: string; cityId?: string; place?: PlaceInput | null; components?: PlaceInput[]; category?: string; summary?: string | null; sourceUrl?: string | null; sourceLabel?: string | null; areaKey?: string | null; areaLabel?: string | null; estimatedDurationMinutes?: number | null; priceMinMinor?: number | null; priceMaxMinor?: number | null; priceCurrency?: string | null; priceBasis?: "per_person" | "per_group" | "per_item" | "free" | "unknown" | null; reference?: { platform?: "official" | "xiaohongshu" | "web" | "manual"; authorLabel?: string | null; title?: string | null; sourceUrl?: string; imageUrls?: string[]; note?: string | null; mediaAssetIds?: string[] } | null };
    if (!body.title?.trim() || !body.category || !categories.has(body.category)) return Response.json({ error: "请填写攻略名称和分类。" }, { status: 400 });
    const kind = body.kind || "place";
    if (kind === "guide" || body.place || body.components || body.reference) {
      const resolvePlace = async (value: PlaceInput | null | undefined) => value?.placeId || (value?.providerPlaceId ? (await createAmapPlace(slug, { providerPlaceId: value.providerPlaceId, cityId: value.cityId }, actor.id)).id : null);
      const rawPlaces = kind === "guide" ? body.components || [] : [body.place || { placeId: body.placeId, providerPlaceId: body.providerPlaceId, cityId: body.cityId }];
      const placeIds = (await Promise.all(rawPlaces.map(resolvePlace))).filter((id): id is string => Boolean(id));
      const allowedAreas = new Set(["shanghai", "hangzhou", "tonglu"]);
      const areaKey = body.areaKey && allowedAreas.has(body.areaKey) ? body.areaKey : null;
      const reference = body.reference?.sourceUrl ? { platform: body.reference.platform || "manual", authorLabel: body.reference.authorLabel ?? null, title: body.reference.title ?? null, sourceUrl: body.reference.sourceUrl, imageUrls: body.reference.imageUrls || [], note: body.reference.note ?? null, mediaAssetIds: body.reference.mediaAssetIds || [] } : null;
      const recommendation = await createMemberRecommendation({ tripId: trip.id, kind, guideType: kind === "guide" ? body.guideType ?? null : null, category: body.category as RecommendationCategory, title: body.title, summary: body.summary ?? null, areaKey, areaLabel: body.areaLabel ?? null, isCore: false, estimatedDurationMinutes: kind === "guide" ? body.estimatedDurationMinutes ?? null : null, priceMinMinor: kind === "place" ? body.priceMinMinor ?? null : null, priceMaxMinor: kind === "place" ? body.priceMaxMinor ?? null : null, priceCurrency: kind === "place" ? body.priceCurrency ?? null : null, priceBasis: kind === "place" ? body.priceBasis ?? null : null, sourceUrl: body.sourceUrl ?? null, sourceLabel: body.sourceLabel ?? null, placeIds, reference }, actor.id);
      return Response.json({ recommendation }, { status: 201 });
    }
    const placeId = body.placeId || (body.providerPlaceId && body.cityId ? (await createAmapPlace(slug, { providerPlaceId: body.providerPlaceId, cityId: body.cityId }, actor.id)).id : null);
    const allowedAreas = new Set(["shanghai", "hangzhou", "tonglu"]);
    const areaKey = body.areaKey && allowedAreas.has(body.areaKey) ? body.areaKey : null;
    const recommendation = await createRecommendation({ tripId: trip.id, kind: "place", category: body.category as RecommendationCategory, title: body.title.trim(), summary: body.summary ?? null, areaKey, areaLabel: body.areaLabel ?? null, sourceUrl: body.sourceUrl ?? null, sourceLabel: body.sourceLabel ?? null, isCore: false, priceMinMinor: body.priceMinMinor ?? null, priceMaxMinor: body.priceMaxMinor ?? null, priceCurrency: body.priceCurrency ?? null, priceBasis: body.priceBasis ?? null }, actor.id);
    if (placeId) await addRecommendationPlaceOption({ recommendationId: recommendation.id, placeId, relationType: "alternative", isPrimary: true, sortOrder: 0 });
    return Response.json({ recommendation }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "TRIP_NOT_FOUND" || code === "RECOMMENDATION_NOT_FOUND" ? 404 : code === "PLACE_NOT_IN_TRIP_CITY" || code.startsWith("INVALID_") || code.endsWith("_REQUIRED") ? 400 : 500;
    const messages: Record<string, string> = { PLACE_REQUIRED: "请先选择一个真实地点。", GUIDE_COMPONENT_REQUIRED: "请至少选择一个攻略地点。", INVALID_REFERENCE_MEDIA: "参考截图无效，请重新上传。", PLACE_NOT_IN_TRIP_CITY: "地点不属于当前行程城市。" };
    return Response.json({ error: messages[code] || (status === 400 ? "素材信息不完整，请检查后重试。" : "攻略素材保存失败，请重试。") }, { status });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const { slug } = await params;
  const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
  const member = (await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0];
  if (!member) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
  return Response.json({ recommendations: await getDb().select().from(recommendationRecords).where(and(eq(recommendationRecords.tripId, trip.id), isNull(recommendationRecords.deletedAt))) });
}
