import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { memberRecords } from "@/db/schema";
import { sessionCookieName, verifySessionMemberId } from "@/services/session";

export const getCurrentMember = cache(async function getCurrentMember() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  const env = getRuntimeEnv();
  const memberId = await verifySessionMemberId(token, env.TRIP_SPACE_SESSION_SECRET, env.DB);
  if (!memberId) return null;
  const member = (await getDb().select().from(memberRecords).where(eq(memberRecords.id, memberId)).limit(1))[0];
  return member?.active ? { ...member, active: Boolean(member.active) } : null;
});
