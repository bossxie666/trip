import { getRuntimeEnv } from "@/db";
import { findActiveMemberByName } from "@/services/member-repository.server";
import { createSessionToken, sessionCookieName } from "@/services/session";

export async function POST(request: Request) {
  const { memberName, code } = await request.json() as { memberName?: string; code?: string };
  const env = getRuntimeEnv();
  if (!env.TRIP_SPACE_INVITE_CODE || !env.TRIP_SPACE_SESSION_SECRET) return Response.json({ error: "旅行空间尚未完成安全配置。" }, { status: 503 });
  const member = memberName ? await findActiveMemberByName(memberName) : null;
  if (!member || code !== env.TRIP_SPACE_INVITE_CODE) return Response.json({ error: "成员或暗号不正确。" }, { status: 401 });
  const token = await createSessionToken(member.id, env.TRIP_SPACE_SESSION_SECRET);
  return Response.json({ member: { id: member.id, displayName: member.displayName } }, { headers: { "set-cookie": `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "set-cookie": `${sessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}
