import { getCurrentMember } from "@/services/auth.server";
import { linkKnowledgeToTrip } from "@/services/knowledge-service.server";
import { apiError, requestIdFrom } from "@/services/api-response";
import { recordAuditEvent } from "@/services/audit.server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const actor = await getCurrentMember(); if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先登录。"); const { tripId } = await request.json() as { tripId?: string }; if (!tripId) return apiError(request, 400, "TRIP_REQUIRED", "请选择旅行。"); try { const id = (await params).id; await linkKnowledgeToTrip(actor.id, id, tripId); await recordAuditEvent({ memberId: actor.id, action: "knowledge.link_trip", resourceType: "knowledge", resourceId: id, requestId: requestIdFrom(request), metadata: { tripId } }); return Response.json({ ok: true }); } catch { return apiError(request, 403, "TRIP_FORBIDDEN", "无法关联这条旅行。"); } }
