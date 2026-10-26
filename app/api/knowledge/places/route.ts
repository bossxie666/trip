import { getCurrentMember } from "@/services/auth.server";
import { apiError, hasValidRequestOrigin } from "@/services/api-response";
import { classifyAmapError, searchAmapPois } from "@/services/amap/amap-web-service.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";
import { resolveKnowledgePoi } from "@/services/knowledge-places.server";

async function authorize(request: Request) {
  const member = await getCurrentMember();
  if (!member) return { response: apiError(request, 401, "UNAUTHORIZED", "请先登录。") };
  if (request.method !== "GET" && !hasValidRequestOrigin(request)) return { response: apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。") };
  const limit = await consumeRateLimit("knowledge-places", member.id, 120, 60_000);
  return limit.allowed ? { member } : { response: rateLimitResponse(limit, "地点操作过于频繁，请稍后再试。") };
}

function failure(request: Request, error: unknown) {
  if (error instanceof SyntaxError) return apiError(request, 400, "INVALID_BODY", "请求内容无效。");
  if (error instanceof Error && error.message === "INVALID_KNOWLEDGE_PLACE") return apiError(request, 400, error.message, "请选择包含城市和坐标的真实地点。");
  const classified = classifyAmapError(error, "poi");
  return apiError(request, classified.status, classified.code, classified.message);
}

export async function GET(request: Request) {
  try {
    const access = await authorize(request); if (access.response) return access.response;
    const url = new URL(request.url), keywords = (url.searchParams.get("keywords") || "").trim().slice(0, 80), region = (url.searchParams.get("region") || "全国").trim().slice(0, 40);
    if (!keywords) return apiError(request, 400, "KEYWORDS_REQUIRED", "请输入地点。");
    return Response.json({ pois: await searchAmapPois(keywords, region) });
  } catch (error) { return failure(request, error); }
}

export async function POST(request: Request) {
  try {
    const access = await authorize(request); if (access.response) return access.response;
    const input = await request.json() as { providerPlaceId?: unknown } | null;
    if (!input || typeof input.providerPlaceId !== "string" || !/^[A-Za-z0-9_-]{3,80}$/.test(input.providerPlaceId)) return apiError(request, 400, "INVALID_KNOWLEDGE_PLACE", "请从搜索结果选择真实地点。");
    const place = await resolveKnowledgePoi(input.providerPlaceId, access.member!.id);
    return Response.json({ place: { id: place.id, name: place.name, address: place.address } });
  } catch (error) { return failure(request, error); }
}
