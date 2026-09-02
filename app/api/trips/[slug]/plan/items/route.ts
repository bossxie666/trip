import { getCurrentMember } from "@/services/auth.server";
import { createItineraryItem, replaceItineraryParticipantOverrides } from "@/services/itinerary-repository.server";
import { getDb } from "@/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { createAmapPlace } from "@/services/place-repository.server";
import { recommendationPlaceOptionRecords, recommendationRecords, tripMemberRecords, tripRecords, placeRecords } from "@/db/schema";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { recommendationId?: string; dayId?: string; placeId?: string; providerPlaceId?: string; cityId?: string; title?: string; itemType?: "place" | "meal" | "transit" | "lodging" | "activity" | "note"; note?: string | null; startTimeLocal?: string | null; endTimeLocal?: string | null; timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours"; openingHoursNote?: string | null; durationMinutes?: number | null; participantMemberIds?: string[] | null };
    const db = getDb();
    const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip || !body.dayId) return Response.json({ error: "行程或日期不存在。" }, { status: 404 });
    if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const recommendationId = body.recommendationId ?? null;
    let placeId = body.placeId ?? null;
    let title = body.title?.trim() || "";
    let itemType = body.itemType || "activity";
    if (recommendationId) {
      const recommendation = (await db.select().from(recommendationRecords).where(and(eq(recommendationRecords.id, recommendationId), isNull(recommendationRecords.deletedAt))).limit(1))[0];
      if (!recommendation) return Response.json({ error: "攻略素材不存在。" }, { status: 404 });
      const option = (await db.select().from(recommendationPlaceOptionRecords).where(eq(recommendationPlaceOptionRecords.recommendationId, recommendation.id)).orderBy(desc(recommendationPlaceOptionRecords.isPrimary), asc(recommendationPlaceOptionRecords.sortOrder)).limit(1))[0];
      placeId = placeId || option?.placeId || null;
      title = title || recommendation.title;
      itemType = body.itemType || (recommendation.kind === "place" ? "place" : "activity");
    } else if (body.providerPlaceId) {
      placeId = (await createAmapPlace(slug, { providerPlaceId: body.providerPlaceId, cityId: body.cityId }, actor.id)).id;
    }
    if (!placeId && !title) return Response.json({ error: "请填写事项名称或选择地点。" }, { status: 400 });
    if (placeId && !title) title = (await db.select({ name: placeRecords.name }).from(placeRecords).where(eq(placeRecords.id, placeId)).limit(1))[0]?.name || "未命名地点";
    const item = await createItineraryItem({ tripId: trip.id, dayId: body.dayId, recommendationId, placeId, itemType, title, note: body.note ?? null, startTimeLocal: body.startTimeLocal ?? null, endTimeLocal: body.endTimeLocal ?? null, timeMode: body.timeMode, openingHoursNote: body.openingHoursNote ?? null, durationMinutes: body.durationMinutes ?? null, lockedAt: null }, actor.id);
    if (Object.prototype.hasOwnProperty.call(body, "participantMemberIds")) await replaceItineraryParticipantOverrides({ tripId: trip.id, itineraryItemId: item.id, memberIds: body.participantMemberIds == null ? null : [...new Set(body.participantMemberIds.map(String))], actorMemberId: actor.id });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "DAY_NOT_IN_TRIP" || code === "ITEM_PLACE_NOT_IN_TRIP_CITY" || code.startsWith("INVALID_") ? 400 : code === "MEMBER_NOT_IN_TRIP" ? 403 : 500;
    return Response.json({ error: status === 400 ? "所选日期或地点不属于当前行程。" : status === 403 ? "你不是这条行程的成员。" : "加入行程失败，请重试。" }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { dayId?: string; orderedItemIds?: string[] };
    if (!body.dayId || !Array.isArray(body.orderedItemIds)) return Response.json({ error: "缺少排序数据。" }, { status: 400 });
    const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const { reorderItineraryItems } = await import("@/services/itinerary-repository.server");
    return Response.json({ items: await reorderItineraryItems(trip.id, body.dayId, body.orderedItemIds.map(String)) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "ITINERARY_ITEM_LOCKED" ? 409 : code === "INVALID_ORDER" || code === "DAY_NOT_IN_TRIP" ? 400 : 500;
    return Response.json({ error: status === 409 ? "已锁定事项需先解锁才能调整。" : status === 400 ? "行程顺序无效。" : "排序失败，请重试。" }, { status });
  }
}
