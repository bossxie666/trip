import { getCurrentMember } from "@/services/auth.server";
import { updateManualPlace } from "@/services/place-repository.server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as { name?: string; cityId?: string; address?: string }; const name = body.name?.trim(), cityId = body.cityId?.trim();
    if (!name || !cityId) return Response.json({ error: "请填写地点名称并选择城市。" }, { status: 400 });
    return Response.json({ place: await updateManualPlace((await params).id, { name, cityId, address: body.address?.trim() || null }, actor.id) });
  } catch (error) {
    const code = error instanceof Error ? error.message : ""; const status = code === "PLACE_NOT_FOUND" ? 404 : code === "PLACE_DUPLICATE" ? 409 : code === "PLACE_NOT_MANUAL" || code === "PLACE_MEMBER_REQUIRED" ? 403 : 500;
    return Response.json({ error: code === "PLACE_NOT_FOUND" ? "地点不存在。" : code === "PLACE_DUPLICATE" ? "同一城市已有同名地点。" : code === "PLACE_NOT_MANUAL" ? "只有手工地点可以修改。" : code === "PLACE_MEMBER_REQUIRED" ? "你没有权限修改这个地点。" : "修改地点失败。" }, { status });
  }
}
