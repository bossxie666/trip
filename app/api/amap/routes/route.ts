import { getCurrentMember } from "@/services/auth.server";
import { getRoutePlaces } from "@/services/place-repository.server";
import { classifyAmapError, planAmapRoute } from "@/services/amap/amap-web-service.server";
import type { AMapRouteMode } from "@/services/amap/amap-types";
import { getDb } from "@/db";
import { and, eq } from "drizzle-orm";
import { tripMemberRecords, tripRecords } from "@/db/schema";

const modes = new Set<AMapRouteMode>(["walking", "subway", "bus", "mixed_transit", "taxi", "driving", "bicycling", "transit"]);

export async function POST(request: Request) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as { slug?: string; originPlaceId?: string; destinationPlaceId?: string; mode?: AMapRouteMode };
    if (!body.slug || !body.originPlaceId || !body.destinationPlaceId || !body.mode || !modes.has(body.mode) || body.originPlaceId === body.destinationPlaceId) return Response.json({ error: "请选择不同的起点、终点和交通方式。" }, { status: 400 });
    const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, body.slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程或地点不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const { origin, destination } = await getRoutePlaces(body.slug, body.originPlaceId, body.destinationPlaceId);
    const route = await planAmapRoute({ mode: body.mode, origin: { longitude: origin.longitude!, latitude: origin.latitude!, providerPlaceId: origin.providerPlaceId, cityCode: origin.cityCode }, destination: { longitude: destination.longitude!, latitude: destination.latitude!, providerPlaceId: destination.providerPlaceId, cityCode: destination.cityCode } });
    return Response.json({ route });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const classified = classifyAmapError(error, "route");
    console.error("amap route planning failed", { requestType: "route-search", code, classifiedCode: classified.code });
    const status = code === "TRIP_NOT_FOUND" || code === "PLACE_NOT_IN_TRIP" ? 404 : code === "MEMBER_NOT_IN_TRIP" ? 403 : code === "PLACE_MISSING_COORDINATES" ? 409 : code === "AMAP_NOT_CONFIGURED" ? 503 : 502;
    const message = code === "PLACE_MISSING_COORDINATES" ? "起点或终点还没有高德坐标。" : status === 404 ? "行程或地点不存在。" : status === 403 ? "你不是这条行程的成员。" : status === 503 && code === "AMAP_NOT_CONFIGURED" ? "地图服务配置异常，请联系管理员。" : classified.message;
    return Response.json({ error: message, code: classified.code }, { status: status === 502 ? classified.status : status });
  }
}
