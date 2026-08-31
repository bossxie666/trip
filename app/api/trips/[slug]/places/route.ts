import { getCurrentMember } from "@/services/auth.server";
import { addPlaceToDay, createAmapPlace, createManualPlace, getPlaceWorkspace, removePlaceFromDay, removePlaceFromTrip, reorderDayPlaces } from "@/services/place-repository.server";

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, [string, number]> = {
    TRIP_NOT_FOUND: ["没有找到这条行程。", 404], DAY_NOT_IN_TRIP: ["这个 Day 不属于当前行程。", 400], PLACE_NOT_FOUND: ["地点不存在。", 404], CITY_NOT_IN_TRIP: ["城市不属于当前行程。", 400], PLACE_CITY_NOT_IN_TRIP: ["该地点不属于当前行程的城市。", 400], INVALID_ORDER: ["地点顺序与当前 Day 不一致。", 409], PLACE_STILL_IN_DAY: ["地点仍在日程中，请先从 Day 移除。", 409], AMAP_NOT_CONFIGURED: ["地图服务尚未配置。", 503], AMAP_POI_NOT_FOUND: ["没有找到这个高德地点。", 404],
  };
  const [message, status] = messages[code] || (code.startsWith("AMAP_") ? ["高德地点暂时无法保存，请稍后重试。", 502] : ["地点操作失败，请重试。", 500]); return Response.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const workspace = await getPlaceWorkspace((await params).slug); return workspace ? Response.json({ workspace }) : Response.json({ error: "没有找到这条行程。" }, { status: 404 }); } catch { return Response.json({ error: "地点数据暂时无法读取。" }, { status: 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const slug = (await params).slug; const body = await request.json() as { action?: string; dayId?: string; placeId?: string; providerPlaceId?: string; name?: string; cityId?: string; address?: string };
    let placeId = body.placeId;
    if (body.action === "create") {
      const name = body.name?.trim(), cityId = body.cityId?.trim(); if (!name || !cityId) return Response.json({ error: "请填写地点名称并选择城市。" }, { status: 400 });
      placeId = (await createManualPlace(slug, { name, cityId, address: body.address?.trim() || null }, actor.id)).id;
    }
    if (body.action === "create-amap") {
      const providerPlaceId = body.providerPlaceId?.trim(), cityId = body.cityId?.trim(); if (!providerPlaceId || !cityId) return Response.json({ error: "请选择高德地点和城市。" }, { status: 400 });
      placeId = (await createAmapPlace(slug, { providerPlaceId, cityId }, actor.id)).id;
    }
    if (!body.dayId || !placeId) return Response.json({ error: "请选择 Day 和地点。" }, { status: 400 });
    const added = await addPlaceToDay(slug, body.dayId, placeId); return Response.json({ added, workspace: await getPlaceWorkspace(slug) }, { status: added ? 201 : 200 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as { dayId?: string; orderedPlaceIds?: string[] }; if (!body.dayId || !Array.isArray(body.orderedPlaceIds)) return Response.json({ error: "缺少排序数据。" }, { status: 400 });
    const slug = (await params).slug; await reorderDayPlaces(slug, body.dayId, body.orderedPlaceIds.map(String)); return Response.json({ workspace: await getPlaceWorkspace(slug) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const url = new URL(request.url), dayId = url.searchParams.get("dayId"), placeId = url.searchParams.get("placeId"), scope = url.searchParams.get("scope"); if (!placeId) return Response.json({ error: "缺少地点。" }, { status: 400 });
    const slug = (await params).slug; if (scope === "trip") await removePlaceFromTrip(slug, placeId); else if (dayId) await removePlaceFromDay(slug, dayId, placeId); else return Response.json({ error: "缺少 Day。" }, { status: 400 });
    return Response.json({ workspace: await getPlaceWorkspace(slug) });
  } catch (error) { return errorResponse(error); }
}
