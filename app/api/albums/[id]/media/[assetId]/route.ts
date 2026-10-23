import { getCurrentMember } from "@/services/auth.server";
import { deleteAlbumMedia, updateAlbumMedia } from "@/services/album-service.server";
import { albumError } from "../../../route";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { return Response.json({ album: await deleteAlbumMedia((await params).id, actor.id, (await params).assetId) }); } catch (error) { return albumError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { const values = await params; return Response.json({ album: await updateAlbumMedia(values.id, actor.id, [values.assetId], await request.json()) }); } catch (error) { return albumError(error); }
}
