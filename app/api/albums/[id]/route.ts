import { getCurrentMember } from "@/services/auth.server";
import { getAlbum, softDeleteAlbum, updateAlbum } from "@/services/album-service.server";
import { albumError } from "../route";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { return Response.json({ album: await getAlbum((await params).id, actor.id) }); } catch (error) { return albumError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { return Response.json({ album: await updateAlbum((await params).id, actor.id, await request.json()) }); } catch (error) { return albumError(error); }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { await softDeleteAlbum((await params).id, actor.id); return Response.json({ ok: true }); } catch (error) { return albumError(error); }
}
