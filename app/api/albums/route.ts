import { getCurrentMember } from "@/services/auth.server";
import { createAlbum, listAlbums } from "@/services/album-service.server";

export async function GET() {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  return Response.json({ albums: await listAlbums(actor.id) });
}

export async function POST(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { return Response.json({ album: await createAlbum(actor.id, await request.json()) }, { status: 201 }); }
  catch (error) { return albumError(error); }
}

export function albumError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "ALBUM_NOT_FOUND") return Response.json({ error: "相册不存在。" }, { status: 404 });
  if (code === "ALBUM_FORBIDDEN" || code === "ALBUM_AUTHOR_REQUIRED") return Response.json({ error: "你没有权限管理这个相册。" }, { status: 403 });
  if (code.startsWith("INVALID_ALBUM_")) return Response.json({ error: "请检查相册信息后重试。" }, { status: 400 });
  if (code === "ALBUM_MEDIA_NOT_FOUND") return Response.json({ error: "照片不存在。" }, { status: 404 });
  return Response.json({ error: "相册操作失败，请稍后重试。" }, { status: 500 });
}
