import { getCurrentMember } from "@/services/auth.server";
import { createGuestbookMessage, listGuestbookMessages } from "@/services/guestbook-service.server";
import { guestbookHeaders, guestbookWrite } from "@/services/guestbook-api.server";

export async function GET() {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401, headers: guestbookHeaders });
  return Response.json({ messages: await listGuestbookMessages(actor.id, 50) }, { headers: guestbookHeaders });
}
export async function POST(request: Request) {
  return guestbookWrite(request, "guestbook.create", null, async actor => {
    const body = await request.json();
    return { message: await createGuestbookMessage(actor, body.body, body.mediaAssetIds ?? [], body.visibility ?? "all", body.memberIds) };
  }, 201);
}
