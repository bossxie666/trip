import { deleteGuestbookMessage, updateGuestbookMessage } from "@/services/guestbook-service.server";
import { guestbookWrite } from "@/services/guestbook-api.server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guestbookWrite(request, "guestbook.update", id, async actor => {
    const body = await request.json();
    return { message: await updateGuestbookMessage(actor, id, body.body, body.visibility, body.memberIds) };
  });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guestbookWrite(request, "guestbook.delete", id, async actor => { await deleteGuestbookMessage(actor, id); return { deleted: true }; });
}
