import { getCurrentMember } from "@/services/auth.server";
import { authorizeMediaUpload } from "@/services/media-response.server";

export async function POST(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  return authorizeMediaUpload(request, actor.id);
}