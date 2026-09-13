import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { guestbookMessageMediaRecords, guestbookMessageRecords, mediaAssetRecords, memberRecords } from "@/db/schema";

export type GuestbookMessageView = {
  id: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string; avatar: string | null };
  media: { id: string; width: number | null; height: number | null }[];
};

export async function listGuestbookMessages(limit = 24): Promise<GuestbookMessageView[]> {
  const rows = await getDb().select({
    id: guestbookMessageRecords.id,
    body: guestbookMessageRecords.body,
    createdAt: guestbookMessageRecords.createdAt,
    updatedAt: guestbookMessageRecords.updatedAt,
    authorId: memberRecords.id,
    authorName: memberRecords.displayName,
    authorAvatar: memberRecords.avatar,
  }).from(guestbookMessageRecords)
    .innerJoin(memberRecords, eq(guestbookMessageRecords.authorMemberId, memberRecords.id))
    .where(isNull(guestbookMessageRecords.deletedAt))
    .orderBy(desc(guestbookMessageRecords.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  const ids = rows.map((row) => row.id);
  const media = ids.length ? await getDb().select({ messageId: guestbookMessageMediaRecords.messageId, id: mediaAssetRecords.id, width: mediaAssetRecords.width, height: mediaAssetRecords.height })
    .from(guestbookMessageMediaRecords)
    .innerJoin(mediaAssetRecords, eq(guestbookMessageMediaRecords.mediaAssetId, mediaAssetRecords.id))
    .where(and(inArray(guestbookMessageMediaRecords.messageId, ids), eq(mediaAssetRecords.status, "ready"))) : [];
  return rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, updatedAt: row.updatedAt, author: { id: row.authorId, displayName: row.authorName, avatar: row.authorAvatar }, media: media.filter((item) => item.messageId === row.id).map(({ id, width, height }) => ({ id, width, height })) }));
}

async function validateMessageMedia(actorMemberId: string, mediaAssetIds: string[]) {
  const ids = [...new Set(mediaAssetIds)].slice(0, 4);
  if (ids.length > 3 || ids.length !== mediaAssetIds.length) throw new Error("INVALID_GUESTBOOK_MEDIA");
  if (!ids.length) return [];
  const rows = await getDb().select({ id: mediaAssetRecords.id }).from(mediaAssetRecords).where(and(inArray(mediaAssetRecords.id, ids), eq(mediaAssetRecords.uploaderMemberId, actorMemberId), eq(mediaAssetRecords.purpose, "guestbook"), eq(mediaAssetRecords.status, "ready")));
  if (rows.length !== ids.length) throw new Error("INVALID_GUESTBOOK_MEDIA");
  return ids;
}

export async function createGuestbookMessage(actorMemberId: string, rawBody: string | null | undefined, rawMediaAssetIds: string[] = []) {
  const body = rawBody?.trim() || null;
  if (body && body.length > 1000) throw new Error("GUESTBOOK_BODY_TOO_LONG");
  const mediaAssetIds = await validateMessageMedia(actorMemberId, rawMediaAssetIds.map(String));
  if (!body && !mediaAssetIds.length) throw new Error("GUESTBOOK_EMPTY");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const env = getRuntimeEnv();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO guestbook_messages (id, author_member_id, body, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)").bind(id, actorMemberId, body, now, now),
    ...mediaAssetIds.map((mediaId, sortOrder) => env.DB.prepare("INSERT INTO guestbook_message_media (message_id, media_asset_id, sort_order) VALUES (?, ?, ?)").bind(id, mediaId, sortOrder)),
  ]);
  return (await listGuestbookMessages(50)).find((message) => message.id === id)!;
}

export async function updateGuestbookMessage(actorMemberId: string, id: string, rawBody: string | null | undefined) {
  const body = rawBody?.trim() || null;
  if (body && body.length > 1000) throw new Error("GUESTBOOK_BODY_TOO_LONG");
  const existing = (await getDb().select({ authorMemberId: guestbookMessageRecords.authorMemberId }).from(guestbookMessageRecords).where(and(eq(guestbookMessageRecords.id, id), isNull(guestbookMessageRecords.deletedAt))).limit(1))[0];
  if (!existing) throw new Error("GUESTBOOK_NOT_FOUND");
  if (existing.authorMemberId !== actorMemberId) throw new Error("GUESTBOOK_OWNER_REQUIRED");
  const mediaCount = (await getDb().select({ id: guestbookMessageMediaRecords.mediaAssetId }).from(guestbookMessageMediaRecords).where(eq(guestbookMessageMediaRecords.messageId, id))).length;
  if (!body && !mediaCount) throw new Error("GUESTBOOK_EMPTY");
  const now = new Date().toISOString();
  await getDb().update(guestbookMessageRecords).set({ body, updatedAt: now }).where(eq(guestbookMessageRecords.id, id));
  return (await listGuestbookMessages(50)).find((message) => message.id === id)!;
}

export async function deleteGuestbookMessage(actorMemberId: string, id: string) {
  const existing = (await getDb().select({ authorMemberId: guestbookMessageRecords.authorMemberId }).from(guestbookMessageRecords).where(and(eq(guestbookMessageRecords.id, id), isNull(guestbookMessageRecords.deletedAt))).limit(1))[0];
  if (!existing) throw new Error("GUESTBOOK_NOT_FOUND");
  if (existing.authorMemberId !== actorMemberId) throw new Error("GUESTBOOK_OWNER_REQUIRED");
  const now = new Date().toISOString();
  await getDb().update(guestbookMessageRecords).set({ deletedAt: now, updatedAt: now }).where(eq(guestbookMessageRecords.id, id));
  return true;
}
