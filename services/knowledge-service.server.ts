import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { knowledgeEntryRecords, knowledgeEntryTagRecords, knowledgeFavoriteRecords, knowledgeMediaRecords, knowledgeTagRecords, knowledgeTripLinkRecords, memberRecords, mediaAssetRecords, tripMemberRecords, tripRecords } from "@/db/schema";

export const knowledgeSections = ["photography", "transition_video", "travel_guide"] as const;
export type KnowledgeSection = typeof knowledgeSections[number];
export type KnowledgeEntryView = typeof knowledgeEntryRecords.$inferSelect & { tags: string[]; mediaAssetIds: string[]; favorite: boolean; authorName: string | null };

function safeSection(value?: string | null): KnowledgeSection | null { return knowledgeSections.includes(value as KnowledgeSection) ? value as KnowledgeSection : null; }
function normalizedTags(value: unknown) { return [...new Set((Array.isArray(value) ? value : []).map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 8))]; }
function safeUrl(value: unknown) { const raw = String(value || "").trim(); if (!raw) return null; const url = new URL(raw); if (url.protocol !== "https:") throw new Error("INVALID_EXTERNAL_URL"); return url.toString(); }

export async function listKnowledge(memberId: string, filters: { section?: string; q?: string; tag?: string; destination?: string; favorite?: boolean } = {}) {
  const db = getDb(); const section = safeSection(filters.section); const q = filters.q?.trim().slice(0, 80); const pattern = q ? `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%` : null;
  const clauses = [isNull(knowledgeEntryRecords.deletedAt)];
  if (section) clauses.push(eq(knowledgeEntryRecords.section, section));
  if (pattern) clauses.push(or(like(knowledgeEntryRecords.title, pattern), like(knowledgeEntryRecords.body, pattern), like(knowledgeEntryRecords.summary, pattern), like(knowledgeEntryRecords.destination, pattern))!);
  if (filters.destination?.trim()) clauses.push(like(knowledgeEntryRecords.destination, `%${filters.destination.trim().slice(0, 80)}%`));
  const rows = await db.select({ entry: knowledgeEntryRecords, authorName: memberRecords.displayName }).from(knowledgeEntryRecords).leftJoin(memberRecords, eq(knowledgeEntryRecords.createdByMemberId, memberRecords.id)).where(and(...clauses)).orderBy(desc(knowledgeEntryRecords.updatedAt)).limit(200);
  if (!rows.length) return [] as KnowledgeEntryView[];
  const ids = rows.map(({ entry }) => entry.id);
  const [tagRows, mediaRows, favorites] = await Promise.all([
    db.select({ entryId: knowledgeEntryTagRecords.entryId, name: knowledgeTagRecords.name }).from(knowledgeEntryTagRecords).innerJoin(knowledgeTagRecords, eq(knowledgeEntryTagRecords.tagId, knowledgeTagRecords.id)).where(inArray(knowledgeEntryTagRecords.entryId, ids)),
    db.select({ entryId: knowledgeMediaRecords.entryId, assetId: knowledgeMediaRecords.mediaAssetId }).from(knowledgeMediaRecords).where(inArray(knowledgeMediaRecords.entryId, ids)).orderBy(knowledgeMediaRecords.sortOrder),
    db.select({ entryId: knowledgeFavoriteRecords.entryId }).from(knowledgeFavoriteRecords).where(and(eq(knowledgeFavoriteRecords.memberId, memberId), inArray(knowledgeFavoriteRecords.entryId, ids))),
  ]);
  const favoriteIds = new Set(favorites.map((item) => item.entryId));
  let result = rows.map(({ entry, authorName }) => ({ ...entry, authorName, tags: tagRows.filter((tag) => tag.entryId === entry.id).map((tag) => tag.name), mediaAssetIds: mediaRows.filter((item) => item.entryId === entry.id).map((item) => item.assetId), favorite: favoriteIds.has(entry.id) }));
  if (filters.favorite) result = result.filter((entry) => entry.favorite);
  if (filters.tag) result = result.filter((entry) => entry.tags.some((tag) => tag === filters.tag));
  return result;
}

export async function getKnowledgeEntry(memberId: string, id: string) {
  const db = getDb();
  const row = (await db.select({ entry: knowledgeEntryRecords, authorName: memberRecords.displayName }).from(knowledgeEntryRecords).leftJoin(memberRecords, eq(knowledgeEntryRecords.createdByMemberId, memberRecords.id)).where(and(eq(knowledgeEntryRecords.id, id), isNull(knowledgeEntryRecords.deletedAt))).limit(1))[0];
  if (!row) return null;
  const [tagRows, mediaRows, favorite] = await Promise.all([
    db.select({ name: knowledgeTagRecords.name }).from(knowledgeEntryTagRecords).innerJoin(knowledgeTagRecords, eq(knowledgeEntryTagRecords.tagId, knowledgeTagRecords.id)).where(eq(knowledgeEntryTagRecords.entryId, id)),
    db.select({ assetId: knowledgeMediaRecords.mediaAssetId }).from(knowledgeMediaRecords).where(eq(knowledgeMediaRecords.entryId, id)).orderBy(knowledgeMediaRecords.sortOrder),
    db.select({ entryId: knowledgeFavoriteRecords.entryId }).from(knowledgeFavoriteRecords).where(and(eq(knowledgeFavoriteRecords.memberId, memberId), eq(knowledgeFavoriteRecords.entryId, id))).limit(1),
  ]);
  return { ...row.entry, authorName: row.authorName, tags: tagRows.map((tag) => tag.name), mediaAssetIds: mediaRows.map((item) => item.assetId), favorite: favorite.length > 0 } satisfies KnowledgeEntryView;
}

export async function saveKnowledgeEntry(actorId: string, input: Record<string, unknown>, id?: string) {
  const db = getDb(), section = safeSection(String(input.section || "")), title = String(input.title || "").trim().slice(0, 120);
  if (!section || !title) throw new Error("INVALID_KNOWLEDGE_ENTRY");
  const body = String(input.body || "").trim().slice(0, 12000) || null, summary = String(input.summary || "").trim().slice(0, 500) || null, destination = String(input.destination || "").trim().slice(0, 100) || null, externalUrl = safeUrl(input.externalUrl), now = new Date().toISOString(), entryId = id || crypto.randomUUID();
  const mediaIds = [...new Set((Array.isArray(input.mediaAssetIds) ? input.mediaAssetIds : []).map(String))].slice(0, 12);
  if (id) {
    const existing = (await db.select({ id: knowledgeEntryRecords.id }).from(knowledgeEntryRecords).where(and(eq(knowledgeEntryRecords.id, id), isNull(knowledgeEntryRecords.deletedAt))).limit(1))[0]; if (!existing) throw new Error("KNOWLEDGE_NOT_FOUND");
    await db.update(knowledgeEntryRecords).set({ section, title, body, summary, destination, externalUrl, updatedByMemberId: actorId, updatedAt: now }).where(eq(knowledgeEntryRecords.id, id));
  } else await db.insert(knowledgeEntryRecords).values({ id: entryId, section, title, body, summary, destination, externalUrl, createdByMemberId: actorId, updatedByMemberId: actorId, createdAt: now, updatedAt: now });
  await db.delete(knowledgeEntryTagRecords).where(eq(knowledgeEntryTagRecords.entryId, entryId));
  for (const name of normalizedTags(input.tags)) { const normalized = name.toLocaleLowerCase("zh-CN"); let tag = (await db.select().from(knowledgeTagRecords).where(eq(knowledgeTagRecords.normalizedName, normalized)).limit(1))[0]; if (!tag) { tag = { id: crypto.randomUUID(), name, normalizedName: normalized, createdAt: now }; await db.insert(knowledgeTagRecords).values(tag); } await db.insert(knowledgeEntryTagRecords).values({ entryId, tagId: tag.id }).onConflictDoNothing(); }
  const alreadyLinked = id ? await db.select({ id: knowledgeMediaRecords.mediaAssetId }).from(knowledgeMediaRecords).where(eq(knowledgeMediaRecords.entryId, entryId)) : [];
  const uploaded = mediaIds.length ? await db.select({ id: mediaAssetRecords.id }).from(mediaAssetRecords).where(and(inArray(mediaAssetRecords.id, mediaIds), eq(mediaAssetRecords.uploaderMemberId, actorId), eq(mediaAssetRecords.purpose, "knowledge_image"), eq(mediaAssetRecords.status, "ready"))) : [];
  const allowed = new Set([...alreadyLinked, ...uploaded].map((item) => item.id));
  if (mediaIds.some((assetId) => !allowed.has(assetId))) throw new Error("INVALID_KNOWLEDGE_MEDIA");
  await db.delete(knowledgeMediaRecords).where(eq(knowledgeMediaRecords.entryId, entryId));
  if (mediaIds.length) await db.insert(knowledgeMediaRecords).values(mediaIds.map((assetId, sortOrder) => ({ entryId, mediaAssetId: assetId, sortOrder })));
  await db.update(knowledgeEntryRecords).set({ coverMediaAssetId: mediaIds[0] || null }).where(eq(knowledgeEntryRecords.id, entryId));
  return getKnowledgeEntry(actorId, entryId);
}

export async function softDeleteKnowledge(actorId: string, id: string) { const now = new Date().toISOString(); const result = await getDb().update(knowledgeEntryRecords).set({ deletedAt: now, updatedAt: now, updatedByMemberId: actorId }).where(and(eq(knowledgeEntryRecords.id, id), isNull(knowledgeEntryRecords.deletedAt))).returning({ id: knowledgeEntryRecords.id }); if (!result.length) throw new Error("KNOWLEDGE_NOT_FOUND"); }
export async function setKnowledgeFavorite(memberId: string, id: string, favorite: boolean) { const db = getDb(); if (favorite) await db.insert(knowledgeFavoriteRecords).values({ entryId: id, memberId, createdAt: new Date().toISOString() }).onConflictDoNothing(); else await db.delete(knowledgeFavoriteRecords).where(and(eq(knowledgeFavoriteRecords.entryId, id), eq(knowledgeFavoriteRecords.memberId, memberId))); }

export async function listKnowledgeTripOptions(memberId: string) { return getDb().select({ id: tripRecords.id, slug: tripRecords.slug, title: tripRecords.title }).from(tripMemberRecords).innerJoin(tripRecords, eq(tripMemberRecords.tripId, tripRecords.id)).where(eq(tripMemberRecords.memberId, memberId)).orderBy(desc(tripRecords.startDate)); }
export async function linkKnowledgeToTrip(memberId: string, entryId: string, tripId: string) { const membership = (await getDb().select({ id: tripMemberRecords.tripId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.memberId, memberId), eq(tripMemberRecords.tripId, tripId))).limit(1))[0]; if (!membership) throw new Error("TRIP_FORBIDDEN"); await getDb().insert(knowledgeTripLinkRecords).values({ entryId, tripId, createdByMemberId: memberId, createdAt: new Date().toISOString() }).onConflictDoNothing(); }

export async function getMemberPersona(memberId: string) { const row = await getRuntimeEnv().DB.prepare("SELECT model_url modelUrl, preview_media_asset_id previewMediaAssetId, resource_version resourceVersion, display_config_json displayConfigJson FROM member_personas WHERE member_id=?").bind(memberId).first(); return row || null; }
