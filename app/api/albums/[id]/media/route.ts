import { getCurrentMember } from "@/services/auth.server";
import { attachAlbumMedia, reorderAlbumMedia } from "@/services/album-service.server";
import { albumError } from "../../route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { const body = await request.json() as { assetIds?: string[] }; return Response.json({ album: await attachAlbumMedia((await params).id, actor.id, Array.isArray(body.assetIds) ? body.assetIds.map(String) : []) }); } catch (error) { return albumError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { const body = await request.json() as { assetIds?: string[] }; return Response.json({ album: await reorderAlbumMedia((await params).id, actor.id, Array.isArray(body.assetIds) ? body.assetIds.map(String) : []) }); } catch (error) { return albumError(error); }
}
