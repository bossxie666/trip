import { cookies } from "next/headers";
import { cache } from "react";
import { getRuntimeEnv } from "@/db";
import type { memberRecords } from "@/db/schema";
import { sessionCookieName, verifySessionMemberId } from "@/services/session";

export const getCurrentMember = cache(async function getCurrentMember() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  const env = getRuntimeEnv();
  const memberId = await verifySessionMemberId(token, env.TRIP_SPACE_SESSION_SECRET, env.DB);
  if (!memberId) return null;
  const member = await env.DB.prepare(`SELECT id, name, display_name AS displayName, avatar, active, role,
    credential_status AS credentialStatus, last_login_at AS lastLoginAt, created_at AS createdAt
    FROM members WHERE id=? LIMIT 1`).bind(memberId).first<typeof memberRecords.$inferSelect>();
  return member?.active ? { ...member, active: Boolean(member.active) } : null;
});
