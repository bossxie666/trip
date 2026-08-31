import { asc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { memberRecords } from "@/db/schema";

export async function listActiveMembers() {
  const rows = await getDb().select().from(memberRecords).where(eq(memberRecords.active, true)).orderBy(asc(memberRecords.createdAt));
  return rows.map((row) => ({ ...row, active: Boolean(row.active) }));
}

export async function findActiveMember(id: string) {
  const row = (await getDb().select().from(memberRecords).where(eq(memberRecords.id, id)).limit(1))[0];
  return row?.active ? row : null;
}

export async function findActiveMemberByName(name: string) {
  const normalized = name.trim();
  if (!normalized) return null;
  const row = (await getDb().select().from(memberRecords).where(or(eq(memberRecords.name, normalized.toLowerCase()), eq(memberRecords.displayName, normalized))).limit(1))[0];
  return row?.active ? row : null;
}
