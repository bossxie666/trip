import { getCurrentMember } from "@/services/auth.server";
import { deleteGuestbookMessage, updateGuestbookMessage } from "@/services/guestbook-service.server";

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return Response.json({ error: code === "GUESTBOOK_OWNER_REQUIRED" ? "只能修改自己的留言。" : code === "GUESTBOOK_NOT_FOUND" ? "留言不存在。" : code === "GUESTBOOK_BODY_TOO_LONG" ? "留言最多 1000 字。" : "留言内容无效。" }, { status: code === "GUESTBOOK_OWNER_REQUIRED" ? 403 : code === "GUESTBOOK_NOT_FOUND" ? 404 : 400 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { const body = await request.json() as { body?: string | null }; return Response.json({ message: await updateGuestbookMessage(actor.id, (await params).id, body.body) }); }
  catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { await deleteGuestbookMessage(actor.id, (await params).id); return Response.json({ deleted: true }); }
  catch (error) { return errorResponse(error); }
}
