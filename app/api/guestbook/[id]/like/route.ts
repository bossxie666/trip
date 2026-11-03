import { setGuestbookLike } from "@/services/guestbook-service.server";
import { guestbookWrite } from "@/services/guestbook-api.server";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guestbookWrite(request, "guestbook.like", id, async actor => ({ message: await setGuestbookLike(actor, id, (await request.json()).liked) }));
}
