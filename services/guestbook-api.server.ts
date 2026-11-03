import { getCurrentMember } from "./auth.server";
import { apiError, hasValidRequestOrigin, requestIdFrom } from "./api-response";
import { recordAuditEvent } from "./audit.server";
import { consumeRateLimit, rateLimitResponse } from "./rate-limit.server";

export const guestbookHeaders = { "cache-control": "private, no-store" };
export async function guestbookWrite(request: Request, action: string, resourceId: string | null, operation: (actor: string) => Promise<object>, status = 200) {
  if (!hasValidRequestOrigin(request)) return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。");
  const actor = await getCurrentMember();
  if (!actor) return apiError(request, 401, "UNAUTHORIZED", "请先验证旅行成员身份。");
  try {
    const quota = await consumeRateLimit("guestbook-write", actor.id, 120, 60_000);
    if (!quota.allowed) return rateLimitResponse(quota);
    const result = await operation(actor.id);
    await recordAuditEvent({ memberId: actor.id, action, resourceType: "guestbook", resourceId, requestId: requestIdFrom(request) });
    return Response.json(result, { status, headers: guestbookHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known: Record<string, [number, string]> = {
      GUESTBOOK_NOT_FOUND: [404, "留言或回复不存在。"],
      GUESTBOOK_OWNER_REQUIRED: [403, "只能修改自己的留言。"],
      GUESTBOOK_REPLY_OWNER_REQUIRED: [403, "只能删除自己的回复。"],
      GUESTBOOK_BODY_TOO_LONG: [400, "留言或回复最多 1000 字。"],
      INVALID_GUESTBOOK_MEDIA: [400, "每条留言最多上传 3 张自己的图片。"],
      INVALID_GUESTBOOK_MEMBERS: [400, "请重新选择有效的可见成员。"],
      GUESTBOOK_EMPTY: [400, "请填写留言或添加图片。"],
      GUESTBOOK_REPLY_INVALID: [400, "请填写回复内容。"],
      GUESTBOOK_INVALID: [400, "留言内容无效。"],
    };
    const [status, message] = known[code] || (error instanceof SyntaxError || error instanceof TypeError ? [400, "请求格式无效。"] : [500, "留言操作失败，请重试。"]);
    return apiError(request, status, known[code] ? code : "GUESTBOOK_FAILED", message);
  }
}
