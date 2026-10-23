import { getCurrentMember } from "@/services/auth.server";
import { setKnowledgeFavorite } from "@/services/knowledge-service.server";
import { apiError } from "@/services/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const actor = await getCurrentMember(); if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先登录。"); const body = await request.json() as { favorite?: boolean }; await setKnowledgeFavorite(actor.id, (await params).id, body.favorite !== false); return Response.json({ ok: true }); }
