import { and, asc, desc, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { albumMediaRecords, albumMediaTagRecords, albumRecords, albumTagRecords, mediaAssetRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { drainMediaDeletionQueue } from "./media-deletion.server";

export type AlbumSummary = {
  id: string; title: string; description: string | null; tripId: string | null; tripTitle: string | null;
  createdByMemberId: string; coverMediaAssetId: string | null; photoCount: number; updatedAt: string;
  canEditAlbum: boolean;
};

async function membership(tripId: string, memberId: string) {
  return Boolean((await getDb().select({ id: tripMemberRecords.memberId }).from(tripMemberRecords)
    .where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0]);
}

async function albumRow(id: string) {
  return (await getDb().select().from(albumRecords).where(and(eq(albumRecords.id, id), isNull(albumRecords.deletedAt))).limit(1))[0] || null;
}

async function requireAlbumAccess(id: string, memberId: string) {
  const album = await albumRow(id);
  if (!album) throw new Error("ALBUM_NOT_FOUND");
  if (album.tripId && !await membership(album.tripId, memberId)) throw new Error("ALBUM_FORBIDDEN");
  return album;
}

async function requireAlbumEditor(id: string, memberId: string) {
  const album = await requireAlbumAccess(id, memberId);
  if (album.tripId && album.createdByMemberId !== memberId) throw new Error("ALBUM_AUTHOR_REQUIRED");
  return album;
}

export async function listAlbumTripOptions(memberId: string) {
  return getDb().select({ id: tripRecords.id, title: tripRecords.title }).from(tripMemberRecords)
    .innerJoin(tripRecords, eq(tripRecords.id, tripMemberRecords.tripId))
    .where(eq(tripMemberRecords.memberId, memberId)).orderBy(desc(tripRecords.updatedAt));
}

export async function listAlbums(memberId: string): Promise<AlbumSummary[]> {
  const rows = await getDb().select({ ...getTableColumns(albumRecords), tripTitle: tripRecords.title,
    photoCount: sql<number>`(SELECT count(*) FROM album_media am WHERE am.album_id=${albumRecords.id})`,
  }).from(albumRecords).leftJoin(tripRecords, eq(tripRecords.id, albumRecords.tripId))
    .where(and(isNull(albumRecords.deletedAt), or(isNull(albumRecords.tripId),
      sql`EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id=${albumRecords.tripId} AND tm.member_id=${memberId})`)))
    .orderBy(desc(albumRecords.updatedAt));
  return rows.map((row) => ({ ...row, canEditAlbum: !row.tripId || row.createdByMemberId === memberId }));
}

export async function getAlbum(id: string, memberId: string) {
  const album = await requireAlbumAccess(id, memberId);
  const [trip, photos, tags, photoTags] = await Promise.all([
    album.tripId ? getDb().select({ title: tripRecords.title }).from(tripRecords).where(eq(tripRecords.id, album.tripId)).limit(1) : [],
    getDb().select({ assetId: mediaAssetRecords.id, filename: mediaAssetRecords.originalFilename, width: mediaAssetRecords.width, height: mediaAssetRecords.height, uploadedByMemberId: albumMediaRecords.uploadedByMemberId, sortOrder: albumMediaRecords.sortOrder, capturedAt: albumMediaRecords.capturedAt, createdAt: albumMediaRecords.createdAt, isFavorite: albumMediaRecords.isFavorite })
      .from(albumMediaRecords).innerJoin(mediaAssetRecords, eq(mediaAssetRecords.id, albumMediaRecords.mediaAssetId))
      .where(and(eq(albumMediaRecords.albumId, id), eq(mediaAssetRecords.status, "ready"))).orderBy(desc(albumMediaRecords.capturedAt), asc(albumMediaRecords.sortOrder)),
    getDb().select().from(albumTagRecords).where(eq(albumTagRecords.albumId, id)).orderBy(asc(albumTagRecords.name)),
    getDb().select().from(albumMediaTagRecords).where(eq(albumMediaTagRecords.albumId, id)),
  ]);
  return { ...album, tripTitle: trip[0]?.title || null, tags, photos: photos.map((photo) => ({ ...photo, capturedAt: photo.capturedAt || photo.createdAt, tagIds: photoTags.filter((item) => item.mediaAssetId === photo.assetId).map((item) => item.tagId) })), canEditAlbum: !album.tripId || album.createdByMemberId === memberId };
}

export async function createAlbum(memberId: string, input: { title?: string; description?: string | null; tripId?: string | null }) {
  const title = input.title?.trim() || "";
  if (!title || title.length > 80) throw new Error("INVALID_ALBUM_TITLE");
  const description = input.description?.trim() || null;
  if (description && description.length > 500) throw new Error("INVALID_ALBUM_DESCRIPTION");
  const tripId = input.tripId?.trim() || null;
  if (tripId && !await membership(tripId, memberId)) throw new Error("ALBUM_FORBIDDEN");
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await getDb().insert(albumRecords).values({ id, title, description, tripId, createdByMemberId: memberId, createdAt: now, updatedAt: now });
  return getAlbum(id, memberId);
}

export async function updateAlbum(id: string, memberId: string, input: { title?: string; description?: string | null; tripId?: string | null; coverMediaAssetId?: string | null }) {
  const album = await requireAlbumEditor(id, memberId);
  const values: Partial<typeof albumRecords.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (input.title !== undefined) { const title = input.title.trim(); if (!title || title.length > 80) throw new Error("INVALID_ALBUM_TITLE"); values.title = title; }
  if (input.description !== undefined) { const description = input.description?.trim() || null; if (description && description.length > 500) throw new Error("INVALID_ALBUM_DESCRIPTION"); values.description = description; }
  if (input.tripId !== undefined) { const tripId = input.tripId?.trim() || null; if (tripId && (!await membership(tripId, memberId) || !await membership(tripId, album.createdByMemberId))) throw new Error("ALBUM_FORBIDDEN"); values.tripId = tripId; }
  if (input.coverMediaAssetId !== undefined) {
    const assetId = input.coverMediaAssetId || null;
    if (assetId && !(await getDb().select({ id: albumMediaRecords.mediaAssetId }).from(albumMediaRecords).where(and(eq(albumMediaRecords.albumId, id), eq(albumMediaRecords.mediaAssetId, assetId))).limit(1))[0]) throw new Error("INVALID_ALBUM_COVER");
    values.coverMediaAssetId = assetId;
  }
  await getDb().update(albumRecords).set(values).where(eq(albumRecords.id, album.id));
  return getAlbum(id, memberId);
}

export async function softDeleteAlbum(id: string, memberId: string) {
  await requireAlbumEditor(id, memberId);
  const now = new Date().toISOString();
  await getDb().update(albumRecords).set({ deletedAt: now, updatedAt: now }).where(eq(albumRecords.id, id));
}

export async function attachAlbumMedia(id: string, memberId: string, assetIds: string[], capturedAtByAsset: Record<string, string> = {}) {
  await requireAlbumAccess(id, memberId);
  const unique = [...new Set(assetIds)].slice(0, 20);
  if (!unique.length) throw new Error("INVALID_ALBUM_MEDIA");
  const assets = await getDb().select().from(mediaAssetRecords).where(inArray(mediaAssetRecords.id, unique));
  if (assets.length !== unique.length || assets.some((asset) => asset.purpose !== "album" || asset.status !== "ready" || asset.uploaderMemberId !== memberId)) throw new Error("INVALID_ALBUM_MEDIA");
  const reused = await getDb().select({ id: albumMediaRecords.mediaAssetId, albumId: albumMediaRecords.albumId }).from(albumMediaRecords).where(inArray(albumMediaRecords.mediaAssetId, unique));
  if (reused.some((row) => row.albumId !== id)) throw new Error("INVALID_ALBUM_MEDIA");
  const existing = await getDb().select().from(albumMediaRecords).where(eq(albumMediaRecords.albumId, id));
  const existingIds = new Set(existing.map((row) => row.mediaAssetId));
  const additions = unique.filter((assetId) => !existingIds.has(assetId));
  if (additions.length) {
    const now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
    const statements = additions.map((assetId) => d1.prepare("INSERT INTO album_media (album_id,media_asset_id,uploaded_by_member_id,sort_order,captured_at,created_at) SELECT ?,?,?,coalesce(max(sort_order),-1)+1,?,? FROM album_media WHERE album_id=? ON CONFLICT(album_id,media_asset_id) DO NOTHING").bind(id, assetId, memberId, validCapturedAt(capturedAtByAsset[assetId]) || now, now, id));
    statements.push(d1.prepare("UPDATE albums SET cover_media_asset_id=coalesce(cover_media_asset_id,?),updated_at=? WHERE id=?").bind(additions[0], now, id));
    await d1.batch(statements);
  }
  return getAlbum(id, memberId);
}

function validCapturedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() <= Date.now() + 86400000 ? date.toISOString() : null;
}

function mediaIdGroups(assetIds: string[]) {
  const unique = [...new Set(assetIds)];
  if (!unique.length || unique.length > 10000) throw new Error("INVALID_ALBUM_MEDIA");
  const groups: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += 80) groups.push(unique.slice(offset, offset + 80));
  return groups;
}

export async function updateAlbumMedia(id: string, memberId: string, assetIds: string[], input: { isFavorite?: boolean; capturedAt?: string | null; addTagName?: string; removeTagId?: string }) {
  const album = await requireAlbumAccess(id, memberId), groups = mediaIdGroups(assetIds), db = getDb(), d1 = getRuntimeEnv().DB;
  for (const group of groups) {
    const current = await db.select({ id: albumMediaRecords.mediaAssetId }).from(albumMediaRecords).where(and(eq(albumMediaRecords.albumId, id), inArray(albumMediaRecords.mediaAssetId, group)));
    if (current.length !== group.length) throw new Error("ALBUM_MEDIA_NOT_FOUND");
  }
  const assignments: string[] = [], values: (string | number)[] = [];
  if (input.isFavorite !== undefined) { assignments.push("is_favorite=?"); values.push(input.isFavorite ? 1 : 0); }
  if (input.capturedAt !== undefined) {
    if (album.tripId && album.createdByMemberId !== memberId) throw new Error("ALBUM_AUTHOR_REQUIRED");
    const capturedAt = validCapturedAt(input.capturedAt);
    if (!capturedAt) throw new Error("INVALID_ALBUM_DATE");
    assignments.push("captured_at=?"); values.push(capturedAt);
  }
  const name = input.addTagName?.trim().replace(/\s+/g, " ");
  if (input.addTagName !== undefined && (!name || name.length > 24)) throw new Error("INVALID_ALBUM_TAG");
  const statements: D1PreparedStatement[] = [], now = new Date().toISOString();
  for (const group of groups) {
    const placeholders = group.map(() => "?").join(",");
    if (assignments.length) statements.push(d1.prepare(`UPDATE album_media SET ${assignments.join(",")} WHERE album_id=? AND media_asset_id IN (${placeholders})`).bind(...values, id, ...group));
    if (input.removeTagId) statements.push(d1.prepare(`DELETE FROM album_media_tags WHERE album_id=? AND tag_id=? AND media_asset_id IN (${placeholders})`).bind(id, input.removeTagId, ...group));
  }
  if (name) {
    statements.push(d1.prepare("INSERT INTO album_tags (id,album_id,name,created_at) VALUES (?,?,?,?) ON CONFLICT(album_id,name) DO NOTHING").bind(crypto.randomUUID(), id, name, now));
    for (const group of groups) statements.push(d1.prepare(`INSERT INTO album_media_tags (album_id,media_asset_id,tag_id) SELECT m.album_id,m.media_asset_id,t.id FROM album_media m JOIN album_tags t ON t.album_id=m.album_id WHERE m.album_id=? AND t.name=? AND m.media_asset_id IN (${group.map(() => "?").join(",")}) ON CONFLICT DO NOTHING`).bind(id, name, ...group));
  }
  statements.push(d1.prepare("UPDATE albums SET updated_at=? WHERE id=?").bind(now, id));
  await d1.batch(statements);
  return getAlbum(id, memberId);
}

export async function deleteAlbumMediaBatch(id: string, memberId: string, assetIds: string[]) {
  await requireAlbumEditor(id, memberId);
  const groups = mediaIdGroups(assetIds), d1 = getRuntimeEnv().DB;
  // Validate the entire selection before deleting the first photo.
  for (const group of groups) {
    const current = await getDb().select({ id: albumMediaRecords.mediaAssetId }).from(albumMediaRecords)
      .innerJoin(mediaAssetRecords, eq(mediaAssetRecords.id, albumMediaRecords.mediaAssetId))
      .where(and(eq(albumMediaRecords.albumId, id), inArray(albumMediaRecords.mediaAssetId, group), eq(mediaAssetRecords.purpose, "album")));
    if (current.length !== group.length) throw new Error("ALBUM_MEDIA_NOT_FOUND");
  }
  const statements: D1PreparedStatement[] = [], now = new Date().toISOString();
  for (const group of groups) {
    const placeholders = group.map(() => "?").join(",");
    statements.push(d1.prepare(`DELETE FROM album_media_tags WHERE album_id=? AND media_asset_id IN (${placeholders})`).bind(id, ...group));
    statements.push(d1.prepare(`DELETE FROM album_media WHERE album_id=? AND media_asset_id IN (${placeholders})`).bind(id, ...group));
  }
  statements.push(d1.prepare(`UPDATE albums SET cover_media_asset_id=CASE
    WHEN cover_media_asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM album_media WHERE album_id=albums.id AND media_asset_id=albums.cover_media_asset_id)
    THEN (SELECT am.media_asset_id FROM album_media am JOIN media_assets m ON m.id=am.media_asset_id WHERE am.album_id=albums.id AND m.status='ready' ORDER BY am.sort_order LIMIT 1)
    ELSE cover_media_asset_id END,updated_at=? WHERE id=?`).bind(now, id));
  for (const group of groups) {
    const placeholders = group.map(() => "?").join(",");
    statements.push(d1.prepare(`INSERT INTO media_deletion_queue (object_key,asset_id,created_at,next_attempt_at)
      SELECT m.object_key,m.id,?,? FROM media_assets m WHERE m.id IN (${placeholders}) AND m.purpose='album' AND ${unreferencedAsset}
      ON CONFLICT(object_key) DO NOTHING`).bind(now, now, ...group));
    statements.push(d1.prepare(`DELETE FROM media_assets AS m WHERE m.id IN (${placeholders}) AND ${unreferencedAsset}
      AND EXISTS (SELECT 1 FROM media_deletion_queue q WHERE q.object_key=m.object_key AND q.asset_id=m.id)`).bind(...group));
  }
  await d1.batch(statements);
  try {
    const cleaned = await drainMediaDeletionQueue(getRuntimeEnv());
    if (cleaned.failed) console.warn(JSON.stringify({ type: "media_cleanup_deferred", failed: cleaned.failed }));
  } catch {
    // The deletion intent is durable even when storage or acknowledgment fails.
    console.warn(JSON.stringify({ type: "media_cleanup_deferred", reason: "cleanup_unavailable" }));
  }
  return getAlbum(id, memberId);
}

// Keep shared files, including legacy string URL references and soft-deleted
// resources that can still be restored. Only orphaned album assets are queued.
const unreferencedAsset = [
  "NOT EXISTS (SELECT 1 FROM album_media WHERE media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM albums WHERE cover_media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM home_featured_photos WHERE media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM guestbook_message_media WHERE media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM recommendation_reference_media WHERE media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM knowledge_entry_media WHERE media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE cover_media_asset_id=m.id OR instr(cover_image_url,'/api/media/' || m.id)>0)",
  "NOT EXISTS (SELECT 1 FROM member_personas WHERE preview_media_asset_id=m.id)",
  "NOT EXISTS (SELECT 1 FROM trips WHERE instr(cover,'/api/media/' || m.id)>0)",
  "NOT EXISTS (SELECT 1 FROM members WHERE instr(avatar,'/api/media/' || m.id)>0)",
  "NOT EXISTS (SELECT 1 FROM recommendations WHERE instr(cover_image_url,'/api/media/' || m.id)>0)",
  "NOT EXISTS (SELECT 1 FROM recommendation_references WHERE instr(image_urls_json,'/api/media/' || m.id)>0)",
].join(" AND ");
export async function reorderAlbumMedia(id: string, memberId: string, assetIds: string[]) {
  await requireAlbumEditor(id, memberId);
  const current = await getDb().select().from(albumMediaRecords).where(eq(albumMediaRecords.albumId, id));
  if (assetIds.length !== current.length || new Set(assetIds).size !== current.length || current.some((row) => !assetIds.includes(row.mediaAssetId))) throw new Error("INVALID_ALBUM_ORDER");
  for (let index = 0; index < assetIds.length; index += 1) await getDb().update(albumMediaRecords).set({ sortOrder: -index - 1 }).where(and(eq(albumMediaRecords.albumId, id), eq(albumMediaRecords.mediaAssetId, assetIds[index])));
  for (let index = 0; index < assetIds.length; index += 1) await getDb().update(albumMediaRecords).set({ sortOrder: index }).where(and(eq(albumMediaRecords.albumId, id), eq(albumMediaRecords.mediaAssetId, assetIds[index])));
  await getDb().update(albumRecords).set({ updatedAt: new Date().toISOString() }).where(eq(albumRecords.id, id));
  return getAlbum(id, memberId);
}

export async function deleteAlbumMedia(id: string, memberId: string, assetId: string) {
  return deleteAlbumMediaBatch(id, memberId, [assetId]);
}
