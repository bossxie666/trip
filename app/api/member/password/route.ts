import { getCurrentMember } from "@/services/auth.server";
import { apiError, requestIdFrom } from "@/services/api-response";
import { activateCredential, issueServerSession, verifyPassword } from "@/services/identity-auth.server";
import { recordAuditEvent } from "@/services/audit.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";
import { sessionCookieName } from "@/services/session";

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).origin !== new URL(request.url).origin) return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。"); }
    catch { return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。"); }
  }
  const member = await getCurrentMember();
  if (!member) return apiError(request, 401, "AUTH_REQUIRED", "请先登录。");
  const limit = await consumeRateLimit("password-change", member.id, 8, 30 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit, "修改密码尝试过于频繁，请稍后再试。");
  const body = await request.json().catch(() => null) as { currentPassword?: string; newPassword?: string } | null;
  if (!body?.currentPassword || !body.newPassword) return apiError(request, 400, "PASSWORDS_REQUIRED", "请输入当前密码和新密码。");
  if (!await verifyPassword(member.id, body.currentPassword)) return apiError(request, 401, "CURRENT_PASSWORD_INVALID", "当前密码不正确。");
  if (body.currentPassword === body.newPassword) return apiError(request, 400, "PASSWORD_UNCHANGED", "新密码不能与当前密码相同。");
  try { await activateCredential(member.id, body.newPassword); }
  catch (error) { return apiError(request, 400, "INVALID_NEW_PASSWORD", error instanceof Error && error.message === "INVALID_PASSWORD_LENGTH" ? "新密码需要 10–128 个字符。" : "新密码无法保存。"); }
  const token = await issueServerSession(member.id, request.headers.get("user-agent"));
  await recordAuditEvent({ memberId: member.id, action: "credential.change", resourceType: "member", resourceId: member.id, requestId: requestIdFrom(request) });
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store", "set-cookie": `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } });
}
