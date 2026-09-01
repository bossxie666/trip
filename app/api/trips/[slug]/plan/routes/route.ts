import { getCurrentMember } from "@/services/auth.server";
import { getNewPlanRoutePlaces } from "@/services/plan-workspace-service.server";
import { planAmapRoute } from "@/services/amap/amap-web-service.server";
import type { AMapRouteMode } from "@/services/amap/amap-types";

const modes = new Set<AMapRouteMode>(["walking", "driving", "bicycling", "transit"]);
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { originPlaceId?: string; destinationPlaceId?: string; mode?: AMapRouteMode };
    if (!body.originPlaceId || !body.destinationPlaceId || !body.mode || !modes.has(body.mode) || body.originPlaceId === body.destinationPlaceId) return Response.json({ error: "请选择不同的起点、终点和交通方式。" }, { status: 400 });
    const { origin, destination } = await getNewPlanRoutePlaces(slug, body.originPlaceId, body.destinationPlaceId);
    const route = await planAmapRoute({ mode: body.mode, origin: { longitude: origin.longitude!, latitude: origin.latitude!, providerPlaceId: origin.providerPlaceId, cityCode: origin.cityCode }, destination: { longitude: destination.longitude!, latitude: destination.latitude!, providerPlaceId: destination.providerPlaceId, cityCode: destination.cityCode } });
    return Response.json({ route });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "TRIP_NOT_FOUND" || code === "PLACE_NOT_IN_TRIP" ? 404 : code === "PLACE_MISSING_COORDINATES" ? 409 : code === "AMAP_NOT_CONFIGURED" ? 503 : 502;
    return Response.json({ error: status === 409 ? "起点或终点还没有高德坐标。" : status === 404 ? "行程或地点不存在。" : status === 503 ? "地图服务尚未配置。" : "路线规划暂时不可用。" }, { status });
  }
}
