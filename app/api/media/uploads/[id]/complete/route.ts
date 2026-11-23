import { getCurrentMember } from "@/services/auth.server";
import { confirmMediaUpload } from "@/services/media-response.server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  return confirmMediaUpload(request, (await params).id, actor.id);
}