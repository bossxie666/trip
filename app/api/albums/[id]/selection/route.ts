import { getCurrentMember } from "@/services/auth.server";
import { getAlbumPhotoSelection } from "@/services/album-service.server";
import { albumError } from "../../route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    return Response.json(await getAlbumPhotoSelection((await params).id, actor.id, new URL(request.url).searchParams.get("filter") || "all"), { headers: { "cache-control": "no-store" } });
  } catch (error) { return albumError(error); }
}
