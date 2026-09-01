import { getCurrentMember } from "@/services/auth.server";
import { createItineraryItem } from "@/services/itinerary-repository.server";
import { getDb } from "@/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { recommendationPlaceOptionRecords, recommendationRecords, tripRecords } from "@/db/schema";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { recommendationId?: string; dayId?: string };
    const db = getDb();
    const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip || !body.recommendationId || !body.dayId) return Response.json({ error: "行程、素材或日期不存在。" }, { status: 404 });
    const recommendation = (await db.select().from(recommendationRecords).where(and(eq(recommendationRecords.id, body.recommendationId), eq(recommendationRecords.tripId, trip.id), isNull(recommendationRecords.deletedAt))).limit(1))[0];
    if (!recommendation) return Response.json({ error: "攻略素材不存在。" }, { status: 404 });
    const option = (await db.select().from(recommendationPlaceOptionRecords).where(eq(recommendationPlaceOptionRecords.recommendationId, recommendation.id)).orderBy(desc(recommendationPlaceOptionRecords.isPrimary), asc(recommendationPlaceOptionRecords.sortOrder)).limit(1))[0];
    const item = await createItineraryItem({ tripId: trip.id, dayId: body.dayId, recommendationId: recommendation.id, placeId: option?.placeId || null, itemType: recommendation.kind === "place" ? "place" : "activity", title: recommendation.title, lockedAt: null }, actor.id);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "DAY_NOT_IN_TRIP" ? 400 : 500;
    return Response.json({ error: status === 400 ? "所选日期不属于当前行程。" : "加入行程失败，请重试。" }, { status });
  }
}
