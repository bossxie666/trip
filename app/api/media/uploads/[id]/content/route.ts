import { getCurrentMember } from "@/services/auth.server";
import { serveMediaUpload } from "@/services/media-response.server";
import { hasValidRequestOrigin, apiError } from "@/services/api-response";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidRequestOrigin(request)) return apiError(request, 403, "INVALID_ORIGIN", "无法验证请求来源。");
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  return serveMediaUpload(request, (await params).id, actor.id);
}
