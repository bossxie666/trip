import { getRuntimeEnv } from "@/db";
import { findActiveMemberByName } from "@/services/member-repository.server";
import { consumeRateLimit, rateLimitResponse, requestClientIdentifier } from "@/services/rate-limit.server";
import { createSessionToken, sessionCookieName } from "@/services/session";
import { activateCredential, credentialStatus, issueServerSession, revokeSession, verifyPassword } from "@/services/identity-auth.server";
import { readCookie } from "@/services/session";
import { recordAuditEvent } from "@/services/audit.server";
import { requestIdFrom } from "@/services/api-response";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "请求来源无效。" }, { status: 403 });
    } catch {
      return Response.json({ error: "请求来源无效。" }, { status: 403 });
    }
  }
  let body: { memberName?: string; code?: string; password?: string; newPassword?: string };
  try {
    body = await request.json() as { memberName?: string; code?: string; password?: string; newPassword?: string };
  } catch {
    return Response.json({ error: "请求格式无效。" }, { status: 400 });
  }
  const memberName = body.memberName?.trim().slice(0, 80) || "";
  const env = getRuntimeEnv();
  if (!env.TRIP_SPACE_INVITE_CODE || !env.TRIP_SPACE_SESSION_SECRET) return Response.json({ error: "旅行空间尚未完成安全配置。" }, { status: 503 });
  try {
    const clientKey = requestClientIdentifier(request);
    const [ipLimit, memberLimit] = await Promise.all([
      consumeRateLimit("session-ip", clientKey, 60, 10 * 60 * 1000),
      consumeRateLimit("session-member", `${clientKey}:${memberName.toLowerCase()}`, 20, 10 * 60 * 1000),
    ]);
    if (!ipLimit.allowed || !memberLimit.allowed) return rateLimitResponse(!ipLimit.allowed ? ipLimit : memberLimit, "登录尝试过于频繁，请稍后再试。");
  } catch {
    return Response.json({ error: "登录安全服务暂时不可用，请稍后再试。" }, { status: 503 });
  }
  const member = memberName ? await findActiveMemberByName(memberName) : null;
  if (!member) return Response.json({ code: "INVALID_CREDENTIALS", error: "成员或密码不正确。" }, { status: 401 });
  const status = await credentialStatus(member.id);
  let token: string;
  let activationRequired = false;
  if (status?.credential_status === "disabled") return Response.json({ code: "MEMBER_DISABLED", error: "这个成员账号已停用。" }, { status: 403 });
  if (status?.credential_status === "active") {
    const password = body.password || body.code || "";
    if (!password || !await verifyPassword(member.id, password)) return Response.json({ code: "INVALID_CREDENTIALS", error: "成员或密码不正确。" }, { status: 401 });
    token = await issueServerSession(member.id, request.headers.get("user-agent"));
  } else {
    if (body.code !== env.TRIP_SPACE_INVITE_CODE) return Response.json({ code: "INVALID_CREDENTIALS", error: "成员或暗号不正确。" }, { status: 401 });
    if (status && body.newPassword) {
      try { await activateCredential(member.id, body.newPassword); }
      catch (caught) {
        console.error(JSON.stringify({ type: "credential_activation_error", memberId: member.id, error: caught instanceof Error ? caught.message : "UnknownError" }));
        return Response.json({ code: "INVALID_PASSWORD", error: caught instanceof Error && caught.message === "INVALID_PASSWORD_LENGTH" ? "个人密码需要 10–128 个字符。" : "个人密码设置失败，请重试。" }, { status: 400 });
      }
      token = await issueServerSession(member.id, request.headers.get("user-agent"));
      await recordAuditEvent({ memberId: member.id, action: "credential.activate", resourceType: "member", resourceId: member.id, requestId });
    } else {
      token = await createSessionToken(member.id, env.TRIP_SPACE_SESSION_SECRET);
      activationRequired = Boolean(status);
    }
  }
  try { await env.DB.prepare("UPDATE members SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), member.id).run(); } catch { /* migration not applied yet */ }
  await recordAuditEvent({ memberId: member.id, action: "session.login", resourceType: "member", resourceId: member.id, requestId, metadata: { serverSession: token.startsWith("v2.") } });
  return Response.json({ member: { id: member.id, displayName: member.displayName }, activationRequired }, { headers: { "set-cookie": `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } });
}

export async function DELETE(request: Request) {
  const allDevices = new URL(request.url).searchParams.get("all") === "true";
  await revokeSession(readCookie(request, sessionCookieName), allDevices);
  await recordAuditEvent({ action: allDevices ? "session.logout_all" : "session.logout", resourceType: "session", requestId: requestIdFrom(request) });
  return Response.json({ ok: true }, { headers: { "set-cookie": `${sessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}
