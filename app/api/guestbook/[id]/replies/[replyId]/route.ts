import { deleteGuestbookReply } from "@/services/guestbook-service.server";
import { guestbookWrite } from "@/services/guestbook-api.server";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const { id, replyId } = await params;
  return guestbookWrite(request, "guestbook.reply.delete", id, async actor => ({ message: await deleteGuestbookReply(actor, id, replyId) }));
}
