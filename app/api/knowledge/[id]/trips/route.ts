import { getCurrentMember } from "@/services/auth.server";
import { linkKnowledgeToTrip } from "@/services/knowledge-service.server";
import { apiError, requestIdFrom, hasValidRequestOrigin } from "@/services/api-response";
import { recordAuditEvent } from "@/services/audit.server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先登录。");
  if (!hasValidRequestOrigin(request)) return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。");
  try {
    const input = await request.json() as { tripId?: unknown } | null;
    if (!input || typeof input.tripId !== "string" || !input.tripId.trim()) return apiError(request, 400, "TRIP_REQUIRED", "请选择旅行。");
    const id = (await params).id, tripId = input.tripId.trim();
    await linkKnowledgeToTrip(actor.id, id, tripId);
    await recordAuditEvent({ memberId: actor.id, action: "knowledge.link_trip", resourceType: "knowledge", resourceId: id, requestId: requestIdFrom(request), metadata: { tripId } });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return apiError(request, 400, "INVALID_BODY", "请求内容无效。");
    if (error instanceof Error && error.message === "KNOWLEDGE_NOT_FOUND") return apiError(request, 404, error.message, "知识内容不存在或已删除。");
    if (error instanceof Error && error.message === "TRIP_FORBIDDEN") return apiError(request, 403, error.message, "无法关联这条旅行。");
    return apiError(request, 500, "LINK_FAILED", "关联失败，请重试。");
  }
}
