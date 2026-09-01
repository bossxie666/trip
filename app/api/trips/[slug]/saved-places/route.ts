import { getCurrentMember } from "@/services/auth.server";
import { deleteSavedPlace, listSavedPlaces, savePlaceForTrip } from "@/services/saved-place-repository.server";

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const status = code === "TRIP_NOT_FOUND" || code === "SAVED_PLACE_NOT_FOUND" ? 404 : code === "MEMBER_NOT_IN_TRIP" ? 403 : code === "PLACE_NOT_IN_TRIP" || code === "CITY_REQUIRED" || code === "PLACE_REQUIRED" ? 400 : code.startsWith("AMAP_") ? 502 : 500;
  return Response.json({ error: status === 404 ? "暂存地点不存在。" : status === 400 ? "请先选择一个属于当前行程的地点。" : "暂存地点操作失败，请重试。" }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    return Response.json({ savedPlaces: await listSavedPlaces((await params).slug, actor.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as { placeId?: string; providerPlaceId?: string; cityId?: string; name?: string; address?: string | null };
    const saved = await savePlaceForTrip((await params).slug, body, actor.id);
    return Response.json({ savedPlace: saved }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id"); if (!id) return Response.json({ error: "缺少暂存地点。" }, { status: 400 });
    await deleteSavedPlace((await params).slug, id, actor.id);
    return Response.json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}
