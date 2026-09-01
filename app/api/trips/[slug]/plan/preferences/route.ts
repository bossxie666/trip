import { getCurrentMember } from "@/services/auth.server";
import { listRoutePreferences, upsertRoutePreference } from "@/services/route-preference-repository.server";
import type { RoutePreferenceMode, RouteSource } from "@/models/planning";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tripMemberRecords, tripRecords } from "@/db/schema";

const modes = new Set<RoutePreferenceMode>(["walking", "subway", "bus", "mixed_transit", "taxi"]);
const sources = new Set<RouteSource>(["itinerary", "booking"]);

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const slug = (await params).slug;
    const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const url = new URL(request.url);
    return Response.json({ preferences: await listRoutePreferences(slug, url.searchParams.get("dayId") || undefined) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "TRIP_NOT_FOUND" ? "行程不存在。" : "路线偏好暂时无法读取。" }, { status: code === "TRIP_NOT_FOUND" ? 404 : 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { dayId?: string; fromSource?: RouteSource; fromId?: string; toSource?: RouteSource; toId?: string; memberId?: string | null; preferredMode?: RoutePreferenceMode };
    if (!body.dayId || !body.fromSource || !sources.has(body.fromSource) || !body.fromId || !body.toSource || !sources.has(body.toSource) || !body.toId || !body.preferredMode || !modes.has(body.preferredMode)) return Response.json({ error: "路线偏好数据不完整。" }, { status: 400 });
    if (body.memberId && body.memberId !== actor.id) return Response.json({ error: "只能保存自己的成员路线偏好。" }, { status: 403 });
    return Response.json({ preference: await upsertRoutePreference((await params).slug, { dayId: body.dayId, fromSource: body.fromSource, fromId: body.fromId, toSource: body.toSource, toId: body.toId, memberId: body.memberId ?? actor.id, preferredMode: body.preferredMode }, actor.id) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "DAY_NOT_IN_TRIP" ? "日期不属于当前行程。" : code === "MEMBER_NOT_IN_TRIP" ? "成员不属于当前行程。" : code === "SEGMENT_POINT_NOT_IN_TRIP" ? "路线端点不属于当前行程。" : "路线偏好保存失败。" }, { status: code === "DAY_NOT_IN_TRIP" || code === "MEMBER_NOT_IN_TRIP" || code === "SEGMENT_POINT_NOT_IN_TRIP" ? 400 : 500 });
  }
}
