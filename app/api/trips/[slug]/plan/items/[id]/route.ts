import { getCurrentMember } from "@/services/auth.server";
import { deleteItineraryItem, updateItineraryItem } from "@/services/itinerary-repository.server";
import { getDb } from "@/db";
import { and, eq } from "drizzle-orm";
import { tripMemberRecords, tripRecords } from "@/db/schema";

async function tripIdForSlug(slug: string) {
  return (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0]?.id;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug, id } = await params, tripId = await tripIdForSlug(slug);
    if (!tripId) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const body = await request.json() as { title?: string; note?: string | null; startTimeLocal?: string | null; durationMinutes?: number | null; dayId?: string };
    const item = await updateItineraryItem(tripId, id, body, actor.id);
    return Response.json({ item });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "ITINERARY_ITEM_NOT_FOUND" ? 404 : code === "ITINERARY_ITEM_LOCKED" ? 409 : code === "MEMBER_NOT_IN_TRIP" ? 403 : code === "DAY_NOT_IN_TRIP" || code.startsWith("INVALID_") || code === "ITINERARY_TITLE_REQUIRED" ? 400 : 500;
    return Response.json({ error: status === 404 ? "行程事项不存在。" : status === 409 ? "已锁定事项需先解锁才能移动。" : status === 403 ? "你不是这条行程的成员。" : status === 400 ? "行程事项内容无效。" : "更新失败，请重试。" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug, id } = await params, tripId = await tripIdForSlug(slug);
    if (!tripId) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    await deleteItineraryItem(tripId, id);
    return Response.json({ deleted: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "ITINERARY_ITEM_NOT_FOUND" ? "行程事项不存在。" : "删除失败，请重试。" }, { status: code === "ITINERARY_ITEM_NOT_FOUND" ? 404 : 500 });
  }
}
