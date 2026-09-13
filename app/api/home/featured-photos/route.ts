import { getCurrentMember } from "@/services/auth.server";
import { setHomeFeaturedPhoto } from "@/services/media-service.server";

export async function PUT(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { slotKey?: string; assetId?: string };
    if ((body.slotKey !== "map_primary" && body.slotKey !== "map_secondary") || !body.assetId) return Response.json({ error: "照片槽位无效。" }, { status: 400 });
    return Response.json(await setHomeFeaturedPhoto(actor.id, body.slotKey, body.assetId));
  } catch {
    return Response.json({ error: "只能使用你刚刚上传的首页照片。" }, { status: 400 });
  }
}
