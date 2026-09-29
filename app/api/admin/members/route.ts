import { getCurrentMember } from "@/services/auth.server";
import { apiError, requestIdFrom } from "@/services/api-response";
import { recordAuditEvent } from "@/services/audit.server";
import { getRuntimeEnv } from "@/db";

async function requireAdmin(request: Request) {
  const member = await getCurrentMember();
  if (!member) return { error: apiError(request, 401, "AUTH_REQUIRED", "请先登录。") };
  if (member.role !== "admin") return { error: apiError(request, 403, "ADMIN_REQUIRED", "只有管理员可以管理成员。") };
  return { member };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const result = await getRuntimeEnv().DB.prepare("SELECT id, display_name, active, role, credential_status, last_login_at FROM members ORDER BY created_at, display_name").all<{ id: string; display_name: string; active: number; role: string; credential_status: string; last_login_at: string | null }>();
  return Response.json({ members: result.results.map((row) => ({ id: row.id, displayName: row.display_name, active: Boolean(row.active), role: row.role, credentialStatus: row.credential_status, lastLoginAt: row.last_login_at })) }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null) as { memberId?: string; active?: boolean } | null;
  if (!body?.memberId || typeof body.active !== "boolean") return apiError(request, 400, "INVALID_MEMBER_UPDATE", "成员状态无效。");
  if (body.memberId === auth.member.id && !body.active) return apiError(request, 409, "CANNOT_DISABLE_SELF", "不能停用当前登录的管理员。");
  const db = getRuntimeEnv().DB;
  const target = await db.prepare("SELECT id FROM members WHERE id = ? LIMIT 1").bind(body.memberId).first<{ id: string }>();
  if (!target) return apiError(request, 404, "MEMBER_NOT_FOUND", "成员不存在。");
  const now = new Date().toISOString();
  if (body.active) {
    await db.batch([
      db.prepare("UPDATE members SET active = 1, credential_status = 'legacy' WHERE id = ?").bind(body.memberId),
      db.prepare("DELETE FROM member_credentials WHERE member_id = ?").bind(body.memberId),
      db.prepare("UPDATE member_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL").bind(now, body.memberId),
    ]);
  } else {
    await db.batch([
      db.prepare("UPDATE members SET active = 0, credential_status = 'disabled' WHERE id = ?").bind(body.memberId),
      db.prepare("UPDATE member_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL").bind(now, body.memberId),
    ]);
  }
  await recordAuditEvent({ memberId: auth.member.id, action: body.active ? "member.enable" : "member.disable", resourceType: "member", resourceId: body.memberId, requestId: requestIdFrom(request) });
  return Response.json({ ok: true });
}
