import { getRuntimeEnv } from "@/db";
import { findActiveMemberByName } from "@/services/member-repository.server";
import { consumeRateLimit, rateLimitResponse, requestClientIdentifier } from "@/services/rate-limit.server";
import { createSessionToken, sessionCookieName } from "@/services/session";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "请求来源无效。" }, { status: 403 });
    } catch {
      return Response.json({ error: "请求来源无效。" }, { status: 403 });
    }
  }
  let body: { memberName?: string; code?: string };
  try {
    body = await request.json() as { memberName?: string; code?: string };
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
  if (!member || body.code !== env.TRIP_SPACE_INVITE_CODE) return Response.json({ error: "成员或暗号不正确。" }, { status: 401 });
  const token = await createSessionToken(member.id, env.TRIP_SPACE_SESSION_SECRET);
  return Response.json({ member: { id: member.id, displayName: member.displayName } }, { headers: { "set-cookie": `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "set-cookie": `${sessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}
