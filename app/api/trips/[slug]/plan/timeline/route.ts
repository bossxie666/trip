import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { replaceDayTimelinePositions, type TimelinePlacementInput } from "@/services/timeline-placement-repository.server";

type TimelineEntry = { source?: "itinerary" | "booking"; sourceId?: string; anchorKind?: string | null };

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { dayId?: string; entries?: TimelineEntry[] };
    if (!body.dayId || !Array.isArray(body.entries) || !body.entries.length) return Response.json({ error: "缺少时间线顺序。" }, { status: 400 });
    const db = getDb();
    const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const entries: TimelinePlacementInput[] = body.entries.map((entry) => ({ source: entry.source as TimelinePlacementInput["source"], sourceId: String(entry.sourceId || ""), anchorKind: entry.anchorKind ?? null }));
    if (entries.some((entry) => !["itinerary", "booking"].includes(entry.source) || !entry.sourceId)) return Response.json({ error: "时间线顺序无效。" }, { status: 400 });
    const timeline = await replaceDayTimelinePositions({ tripId: trip.id, dayId: body.dayId, entries, actorMemberId: actor.id });
    return Response.json({ timeline });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "DAY_NOT_IN_TRIP" ? 404 : code === "MEMBER_NOT_IN_TRIP" ? 403 : code === "INVALID_TIMELINE_ORDER" ? 400 : 500;
    return Response.json({ error: status === 404 ? "日期不属于当前行程。" : status === 403 ? "你不是这条行程的成员。" : status === 400 ? "时间线顺序无效。" : "时间线保存失败，请重试。" }, { status });
  }
}
