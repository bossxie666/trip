import { asc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssetRecords, memberRecords } from "@/db/schema";
import { and } from "drizzle-orm";
import { getRuntimeEnv } from "@/db";

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

export async function updateMemberAvatar(memberId: string, assetId: string) {
  const db = getDb();
  const asset = (await db.select().from(mediaAssetRecords).where(and(eq(mediaAssetRecords.id, assetId), eq(mediaAssetRecords.uploaderMemberId, memberId), eq(mediaAssetRecords.purpose, "member_avatar"), eq(mediaAssetRecords.status, "ready"))).limit(1))[0];
  if (!asset) throw new Error("INVALID_MEMBER_AVATAR");
  const member = await findActiveMember(memberId);
  if (!member) throw new Error("MEMBER_NOT_FOUND");
  const oldMatch = member.avatar?.match(/^\/api\/media\/([^?]+)/);
  const avatar = `/api/media/${asset.id}?variant=card`;
  await db.update(memberRecords).set({ avatar }).where(eq(memberRecords.id, memberId));
  if (oldMatch?.[1] && oldMatch[1] !== asset.id) {
    const old = (await db.select().from(mediaAssetRecords).where(and(eq(mediaAssetRecords.id, decodeURIComponent(oldMatch[1])), eq(mediaAssetRecords.uploaderMemberId, memberId), eq(mediaAssetRecords.purpose, "member_avatar"))).limit(1))[0];
    if (old) { await getRuntimeEnv().MEDIA?.delete(old.objectKey); await db.delete(mediaAssetRecords).where(eq(mediaAssetRecords.id, old.id)); }
  }
  return { id: member.id, displayName: member.displayName, avatar };
}
