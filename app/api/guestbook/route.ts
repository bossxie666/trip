import { getCurrentMember } from "@/services/auth.server";
import { createGuestbookMessage, listGuestbookMessages } from "@/services/guestbook-service.server";

export async function GET() {
  if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  return Response.json({ messages: await listGuestbookMessages() });
}

export async function POST(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { body?: string | null; mediaAssetIds?: string[] };
    return Response.json({ message: await createGuestbookMessage(actor.id, body.body, Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds : []) }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "GUESTBOOK_BODY_TOO_LONG" ? "留言最多 1000 字。" : code === "INVALID_GUESTBOOK_MEDIA" ? "每条留言最多上传 3 张自己的图片。" : "请先写一句话或选择图片。" }, { status: 400 });
  }
}
