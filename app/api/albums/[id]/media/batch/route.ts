import { getCurrentMember } from "@/services/auth.server";
import { deleteAlbumMediaBatch, updateAlbumMedia } from "@/services/album-service.server";
import { albumError } from "../../../route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { assetIds?: string[]; action?: string; isFavorite?: boolean; capturedAt?: string; tagName?: string; tagId?: string };
    const assetIds = Array.isArray(body.assetIds) ? body.assetIds.map(String) : [];
    const input = body.action === "favorite" ? { isFavorite: Boolean(body.isFavorite) } : body.action === "date" ? { capturedAt: body.capturedAt } : body.action === "addTag" ? { addTagName: body.tagName } : body.action === "removeTag" ? { removeTagId: body.tagId } : {};
    if (!body.action || !["favorite", "date", "addTag", "removeTag"].includes(body.action)) throw new Error("INVALID_ALBUM_MEDIA");
    return Response.json({ album: await updateAlbumMedia((await params).id, actor.id, assetIds, input) });
  } catch (error) { return albumError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { const body = await request.json() as { assetIds?: string[] }; return Response.json({ album: await deleteAlbumMediaBatch((await params).id, actor.id, Array.isArray(body.assetIds) ? body.assetIds.map(String) : []) }); } catch (error) { return albumError(error); }
}
