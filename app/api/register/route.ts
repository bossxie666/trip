import { getRuntimeEnv } from "@/db";
import { apiError, hasValidRequestOrigin, requestIdFrom } from "@/services/api-response";
import { createPasswordCredential } from "@/services/identity-auth.server";
import { createOpaqueSessionToken, sessionCookieName, sessionTokenDigest } from "@/services/session";
import { consumeRateLimit, rateLimitResponse, requestClientIdentifier } from "@/services/rate-limit.server";
import { recordAuditEvent } from "@/services/audit.server";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。");
  const env = getRuntimeEnv();
  if (!env.TRIP_SPACE_SESSION_SECRET || !env.TRIP_SPACE_INVITE_CODE) return apiError(request, 503, "REGISTRATION_CLOSED", "注册暂未开放，请联系管理员。");
  try {
    const limit = await consumeRateLimit("registration-ip", requestClientIdentifier(request), 10, 30 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit, "注册尝试过于频繁，请稍后再试。");
  } catch { return apiError(request, 503, "AUTH_UNAVAILABLE", "注册服务暂时不可用，请稍后再试。"); }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError(request, 400, "INVALID_BODY", "请求格式无效。");
  const { memberName, inviteCode, password, confirmPassword } = body as Record<string, unknown>;
  if (typeof memberName !== "string" || !/^[\p{L}\p{N}_ -]{2,40}$/u.test(memberName.trim())) return apiError(request, 400, "INVALID_NAME", "名字需要 2–40 个字符，可使用文字、数字、空格、下划线或短横线。");
  if (typeof password !== "string" || password.length < 10 || password.length > 128) return apiError(request, 400, "INVALID_PASSWORD", "个人密码需要 10–128 个字符。");
  if (password !== confirmPassword) return apiError(request, 400, "PASSWORD_MISMATCH", "两次输入的个人密码不一致。");
  if (inviteCode !== env.TRIP_SPACE_INVITE_CODE) return apiError(request, 403, "INVALID_INVITE", "邀请码不正确，请向管理员确认。");
  const displayName = memberName.trim(), name = displayName.toLowerCase(), db = env.DB;
  const duplicate = () => db.prepare("SELECT id FROM members WHERE lower(name) = ? OR lower(display_name) = ? LIMIT 1").bind(name, name).first();
  try {
    if (await duplicate()) return apiError(request, 409, "NAME_TAKEN", "这个名字已被使用，请更换名字或直接登录。");
    const id = crypto.randomUUID(), now = new Date(), timestamp = now.toISOString();
    const credential = await createPasswordCredential(password), token = await createOpaqueSessionToken();
    // D1 batches roll back every statement if any insert fails, including a concurrent name collision.
    await db.batch([
      db.prepare("INSERT INTO members (id,name,display_name,active,role,credential_status,created_at,last_login_at) SELECT ?,?,?,1,'member','active',?,? WHERE NOT EXISTS (SELECT 1 FROM members WHERE lower(name) = ? OR lower(display_name) = ?)").bind(id, name, displayName, timestamp, timestamp, name, name),
      db.prepare("INSERT INTO member_credentials (member_id,algorithm,algorithm_version,salt,password_digest,updated_at) VALUES (?,'pbkdf2-sha256-6x100k',2,?,?,?)").bind(id, credential.salt, credential.digest, timestamp),
      db.prepare("INSERT INTO member_sessions (id,token_digest,member_id,device_summary,created_at,last_used_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL)").bind(crypto.randomUUID(), await sessionTokenDigest(token), id, request.headers.get("user-agent")?.slice(0, 180) || null, timestamp, timestamp, new Date(now.getTime() + 30 * 86_400_000).toISOString()),
    ]);
    await recordAuditEvent({ memberId: id, action: "member.register", resourceType: "member", resourceId: id, requestId: requestIdFrom(request) });
    return Response.json({ member: { id, displayName } }, { status: 201, headers: { "cache-control": "no-store", "set-cookie": `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } });
  } catch {
    try { if (await duplicate()) return apiError(request, 409, "NAME_TAKEN", "这个名字已被使用，请更换名字或直接登录。"); } catch { /* storage unavailable */ }
    return apiError(request, 503, "REGISTRATION_FAILED", "注册未完成，请稍后重试。");
  }
}
