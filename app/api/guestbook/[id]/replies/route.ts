import { createGuestbookReply } from "@/services/guestbook-service.server";
import { guestbookWrite } from "@/services/guestbook-api.server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guestbookWrite(request, "guestbook.reply.create", id, async actor => ({ message: await createGuestbookReply(actor, id, (await request.json()).body) }), 201);
}
