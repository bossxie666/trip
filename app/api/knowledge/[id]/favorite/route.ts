import { getCurrentMember } from "@/services/auth.server";
import { setKnowledgeFavorite } from "@/services/knowledge-service.server";
import { apiError, hasValidRequestOrigin } from "@/services/api-response";
import { knowledgeMutationError } from "@/services/knowledge-api.server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先登录。");
  if (!hasValidRequestOrigin(request)) return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。");
  try {
    const body = await request.json() as { favorite?: boolean };
    if (!body || typeof body.favorite !== "boolean") return apiError(request, 400, "INVALID_FAVORITE", "收藏状态无效。");
    await setKnowledgeFavorite(actor.id, (await params).id, body.favorite);
    return Response.json({ ok: true });
  } catch (error) { return knowledgeMutationError(request, error); }
}
