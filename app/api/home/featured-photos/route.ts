import { getCurrentMember } from "@/services/auth.server";
import { clearHomeAtlasPhoto, listHomeFeaturedPhotos, setHomeFeaturedPhoto, setHomeWallPhotos } from "@/services/media-service.server";

export async function GET() {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  return Response.json({ photos: await listHomeFeaturedPhotos(actor.id) });
}

export async function PUT(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { slotKey?: string; assetId?: string; assetIds?: string[] };
    if (body.slotKey === "wall" && Array.isArray(body.assetIds)) return Response.json(await setHomeWallPhotos(actor.id, body.assetIds));
    if ((body.slotKey !== "map_primary" && body.slotKey !== "map_secondary") || !body.assetId) return Response.json({ error: "照片槽位无效。" }, { status: 400 });
    return Response.json(await setHomeFeaturedPhoto(actor.id, body.slotKey, body.assetId));
  } catch {
    return Response.json({ error: "请选择有权查看的相册照片；每张精选照片只能选择一次。" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { slotKey?: string };
    if (body.slotKey !== "map_primary" && body.slotKey !== "map_secondary") return Response.json({ error: "照片槽位无效。" }, { status: 400 });
    await clearHomeAtlasPhoto(actor.id, body.slotKey);
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "无法移除这张地图照片。" }, { status: 400 }); }
}
