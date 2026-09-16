import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { albumMediaRecords, albumRecords, mediaAssetRecords, tripMemberRecords, tripRecords } from "@/db/schema";

export type AlbumSummary = {
  id: string; title: string; description: string | null; tripId: string | null; tripTitle: string | null;
  createdByMemberId: string; coverMediaAssetId: string | null; photoCount: number; updatedAt: string;
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
  const db = getDb();
  const membershipRows = await db.select({ tripId: tripMemberRecords.tripId }).from(tripMemberRecords).where(eq(tripMemberRecords.memberId, memberId));
  const tripIds = membershipRows.map((row) => row.tripId);
  const rows = await db.select().from(albumRecords).where(isNull(albumRecords.deletedAt)).orderBy(desc(albumRecords.updatedAt));
  const visible = rows.filter((row) => !row.tripId || tripIds.includes(row.tripId));
  if (!visible.length) return [];
  const ids = visible.map((row) => row.id);
  const media = await db.select({ albumId: albumMediaRecords.albumId }).from(albumMediaRecords).where(inArray(albumMediaRecords.albumId, ids));
  const tripRows = tripIds.length ? await db.select({ id: tripRecords.id, title: tripRecords.title }).from(tripRecords).where(inArray(tripRecords.id, [...new Set(visible.map((row) => row.tripId).filter(Boolean) as string[])])) : [];
  return visible.map((row) => ({ ...row, tripTitle: tripRows.find((trip) => trip.id === row.tripId)?.title || null, photoCount: media.filter((item) => item.albumId === row.id).length }));
}

export async function getAlbum(id: string, memberId: string) {
  const album = await requireAlbumAccess(id, memberId);
  const [trip, photos] = await Promise.all([
    album.tripId ? getDb().select({ title: tripRecords.title }).from(tripRecords).where(eq(tripRecords.id, album.tripId)).limit(1) : [],
    getDb().select({ assetId: mediaAssetRecords.id, filename: mediaAssetRecords.originalFilename, width: mediaAssetRecords.width, height: mediaAssetRecords.height, uploadedByMemberId: albumMediaRecords.uploadedByMemberId, sortOrder: albumMediaRecords.sortOrder })
      .from(albumMediaRecords).innerJoin(mediaAssetRecords, eq(mediaAssetRecords.id, albumMediaRecords.mediaAssetId))
      .where(and(eq(albumMediaRecords.albumId, id), eq(mediaAssetRecords.status, "ready"))).orderBy(asc(albumMediaRecords.sortOrder)),
  ]);
  return { ...album, tripTitle: trip[0]?.title || null, photos, canEditAlbum: !album.tripId || album.createdByMemberId === memberId };
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

export async function attachAlbumMedia(id: string, memberId: string, assetIds: string[]) {
  await requireAlbumAccess(id, memberId);
  const unique = [...new Set(assetIds)].slice(0, 20);
  if (!unique.length) throw new Error("INVALID_ALBUM_MEDIA");
  const assets = await getDb().select().from(mediaAssetRecords).where(inArray(mediaAssetRecords.id, unique));
  if (assets.length !== unique.length || assets.some((asset) => asset.purpose !== "album" || asset.status !== "ready" || asset.uploaderMemberId !== memberId)) throw new Error("INVALID_ALBUM_MEDIA");
  const reused = await getDb().select({ id: albumMediaRecords.mediaAssetId }).from(albumMediaRecords).where(inArray(albumMediaRecords.mediaAssetId, unique));
  if (reused.length) throw new Error("INVALID_ALBUM_MEDIA");
  const existing = await getDb().select().from(albumMediaRecords).where(eq(albumMediaRecords.albumId, id));
  const existingIds = new Set(existing.map((row) => row.mediaAssetId));
  const additions = unique.filter((assetId) => !existingIds.has(assetId));
  if (additions.length) {
    const now = new Date().toISOString(), start = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    await getDb().insert(albumMediaRecords).values(additions.map((assetId, index) => ({ albumId: id, mediaAssetId: assetId, uploadedByMemberId: memberId, sortOrder: start + index, createdAt: now })));
    await getDb().update(albumRecords).set({ coverMediaAssetId: existing.length ? undefined : additions[0], updatedAt: now }).where(eq(albumRecords.id, id));
  }
  return getAlbum(id, memberId);
}

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
  const album = await requireAlbumEditor(id, memberId);
  const asset = (await getDb().select().from(mediaAssetRecords).innerJoin(albumMediaRecords, eq(albumMediaRecords.mediaAssetId, mediaAssetRecords.id)).where(and(eq(albumMediaRecords.albumId, id), eq(mediaAssetRecords.id, assetId))).limit(1))[0];
  if (!asset || asset.media_assets.purpose !== "album") throw new Error("ALBUM_MEDIA_NOT_FOUND");
  const db = getDb();
  if (album.coverMediaAssetId === assetId) await db.update(albumRecords).set({ coverMediaAssetId: null }).where(eq(albumRecords.id, id));
  await db.delete(albumMediaRecords).where(and(eq(albumMediaRecords.albumId, id), eq(albumMediaRecords.mediaAssetId, assetId)));
  await db.delete(mediaAssetRecords).where(eq(mediaAssetRecords.id, assetId));
  await getRuntimeEnv().MEDIA?.delete(asset.media_assets.objectKey);
  const remaining = await db.select({ id: albumMediaRecords.mediaAssetId }).from(albumMediaRecords).where(eq(albumMediaRecords.albumId, id)).orderBy(asc(albumMediaRecords.sortOrder)).limit(1);
  if (album.coverMediaAssetId === assetId && remaining[0]) await db.update(albumRecords).set({ coverMediaAssetId: remaining[0].id, updatedAt: new Date().toISOString() }).where(eq(albumRecords.id, id));
  return getAlbum(id, memberId);
}
