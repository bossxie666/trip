import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { memberRecords } from "@/db/schema";
import { sessionCookieName, verifySessionToken } from "@/services/session";

export async function getCurrentMember() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  const memberId = await verifySessionToken(token, getRuntimeEnv().TRIP_SPACE_SESSION_SECRET);
  if (!memberId) return null;
  const member = (await getDb().select().from(memberRecords).where(eq(memberRecords.id, memberId)).limit(1))[0];
  return member?.active ? { ...member, active: Boolean(member.active) } : null;
}
