import { getCurrentMember } from "@/services/auth.server";
import { listKnowledge, saveKnowledgeEntry } from "@/services/knowledge-service.server";
import { apiError, requestIdFrom } from "@/services/api-response";
import { recordAuditEvent } from "@/services/audit.server";
import { knowledgeMutationError } from "@/services/knowledge-api.server";

function validOrigin(request: Request) { const origin = request.headers.get("origin"); try { return !origin || new URL(origin).origin === new URL(request.url).origin; } catch { return false; } }
export async function GET(request: Request) { const actor = await getCurrentMember(); if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先登录。"); const url = new URL(request.url); return Response.json({ entries: await listKnowledge(actor.id, { section: url.searchParams.get("section") || undefined, q: url.searchParams.get("q") || undefined, tag: url.searchParams.get("tag") || undefined, destination: url.searchParams.get("destination") || undefined, favorite: url.searchParams.get("favorite") === "1" }) }); }
export async function POST(request: Request) { const actor = await getCurrentMember(); if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先登录。"); if (!validOrigin(request)) return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。"); try { const entry = await saveKnowledgeEntry(actor.id, await request.json()); await recordAuditEvent({ memberId: actor.id, action: "knowledge.create", resourceType: "knowledge", resourceId: entry?.id, requestId: requestIdFrom(request) }); return Response.json({ entry }, { status: 201 }); } catch (error) { return knowledgeMutationError(request, error); } }
