import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { knowledgeEntryRecords, knowledgeEntryTagRecords, knowledgeFavoriteRecords, knowledgeMediaRecords, knowledgeTagRecords, knowledgeTripLinkRecords, memberRecords, mediaAssetRecords, tripMemberRecords, tripRecords } from "@/db/schema";

export const knowledgeSections = ["photography", "transition_video", "travel_guide"] as const;
export type KnowledgeSection = typeof knowledgeSections[number];
export type KnowledgeEntryView = typeof knowledgeEntryRecords.$inferSelect & { tags: string[]; mediaAssetIds: string[]; favorite: boolean; authorName: string | null };

function safeSection(value?: string | null): KnowledgeSection | null { return knowledgeSections.includes(value as KnowledgeSection) ? value as KnowledgeSection : null; }
function normalizedTags(value: unknown) { return [...new Set((Array.isArray(value) ? value : []).map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 8))]; }
function safeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try { const url = new URL(raw); if (url.protocol !== "https:") throw new Error(); return url.toString(); }
  catch { throw new Error("INVALID_EXTERNAL_URL"); }
}

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
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_KNOWLEDGE_ENTRY");
  const db = getDb(), section = safeSection(String(input.section || "")), title = String(input.title || "").trim().slice(0, 120);
  if (!section || !title) throw new Error("INVALID_KNOWLEDGE_ENTRY");
  const body = String(input.body || "").trim().slice(0, 12000) || null, summary = String(input.summary || "").trim().slice(0, 500) || null, destination = String(input.destination || "").trim().slice(0, 100) || null, externalUrl = safeUrl(input.externalUrl), now = new Date().toISOString(), entryId = id || crypto.randomUUID();
  if (id) {
    const existing = (await db.select({ id: knowledgeEntryRecords.id }).from(knowledgeEntryRecords).where(and(eq(knowledgeEntryRecords.id, id), isNull(knowledgeEntryRecords.deletedAt))).limit(1))[0]; if (!existing) throw new Error("KNOWLEDGE_NOT_FOUND");
  }
  if (input.mediaAssetIds !== undefined && !Array.isArray(input.mediaAssetIds)) throw new Error("INVALID_KNOWLEDGE_MEDIA");
  const alreadyLinked = id ? await db.select({ id: knowledgeMediaRecords.mediaAssetId }).from(knowledgeMediaRecords).where(eq(knowledgeMediaRecords.entryId, entryId)) : [];
  const mediaIds = [...new Set((Array.isArray(input.mediaAssetIds) ? input.mediaAssetIds.map(String) : alreadyLinked.map((row) => row.id)))];
  if (mediaIds.length > 12) throw new Error("INVALID_KNOWLEDGE_MEDIA");
  const assets = mediaIds.length ? await db.select().from(mediaAssetRecords).where(inArray(mediaAssetRecords.id, mediaIds)) : [];
  const linkedIds = new Set(alreadyLinked.map((row) => row.id));
  if (assets.length !== mediaIds.length || assets.some((asset) => asset.status !== "ready" || (!linkedIds.has(asset.id) && (asset.uploaderMemberId !== actorId || asset.purpose !== "knowledge_image")))) throw new Error("INVALID_KNOWLEDGE_MEDIA");

  // D1 batch is atomic: validate every relation before the first write, then
  // commit the entry, tags and images together (including tag-name races).
  const d1 = getRuntimeEnv().DB;
  const statements = [id
    ? d1.prepare("UPDATE knowledge_entries SET section=?,title=?,body=?,summary=?,destination=?,external_url=?,cover_media_asset_id=?,updated_by_member_id=?,updated_at=? WHERE id=? AND deleted_at IS NULL").bind(section, title, body, summary, destination, externalUrl, mediaIds[0] || null, actorId, now, entryId)
    : d1.prepare("INSERT INTO knowledge_entries (id,section,title,body,summary,destination,external_url,cover_media_asset_id,created_by_member_id,updated_by_member_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(entryId, section, title, body, summary, destination, externalUrl, mediaIds[0] || null, actorId, actorId, now, now),
  ];
  if (input.tags !== undefined || !id) {
    statements.push(d1.prepare("DELETE FROM knowledge_entry_tags WHERE entry_id=?").bind(entryId));
    const tags = new Map(normalizedTags(input.tags).map((name) => [name.toLocaleLowerCase("zh-CN"), name]));
    for (const [normalized, name] of tags) {
      if (name.length > 32) throw new Error("INVALID_KNOWLEDGE_TAG");
      statements.push(d1.prepare("INSERT INTO knowledge_tags (id,name,normalized_name,created_at) VALUES (?,?,?,?) ON CONFLICT(normalized_name) DO NOTHING").bind(crypto.randomUUID(), name, normalized, now));
      statements.push(d1.prepare("INSERT INTO knowledge_entry_tags (entry_id,tag_id) SELECT ?,id FROM knowledge_tags WHERE normalized_name=? ON CONFLICT DO NOTHING").bind(entryId, normalized));
    }
  }
  statements.push(d1.prepare("DELETE FROM knowledge_entry_media WHERE entry_id=?").bind(entryId));
  mediaIds.forEach((assetId, sortOrder) => statements.push(d1.prepare("INSERT INTO knowledge_entry_media (entry_id,media_asset_id,sort_order) VALUES (?,?,?)").bind(entryId, assetId, sortOrder)));
  await d1.batch(statements);
  return getKnowledgeEntry(actorId, entryId);
}

export async function softDeleteKnowledge(actorId: string, id: string) { const now = new Date().toISOString(); const result = await getDb().update(knowledgeEntryRecords).set({ deletedAt: now, updatedAt: now, updatedByMemberId: actorId }).where(and(eq(knowledgeEntryRecords.id, id), isNull(knowledgeEntryRecords.deletedAt))).returning({ id: knowledgeEntryRecords.id }); if (!result.length) throw new Error("KNOWLEDGE_NOT_FOUND"); }
export async function setKnowledgeFavorite(memberId: string, id: string, favorite: boolean) {
  const db = getDb();
  if (!(await db.select({ id: knowledgeEntryRecords.id }).from(knowledgeEntryRecords).where(and(eq(knowledgeEntryRecords.id, id), isNull(knowledgeEntryRecords.deletedAt))).limit(1))[0]) throw new Error("KNOWLEDGE_NOT_FOUND");
  if (favorite) await db.insert(knowledgeFavoriteRecords).values({ entryId: id, memberId, createdAt: new Date().toISOString() }).onConflictDoNothing();
  else await db.delete(knowledgeFavoriteRecords).where(and(eq(knowledgeFavoriteRecords.entryId, id), eq(knowledgeFavoriteRecords.memberId, memberId)));
}

export async function listKnowledgeTripOptions(memberId: string) { return getDb().select({ id: tripRecords.id, slug: tripRecords.slug, title: tripRecords.title }).from(tripMemberRecords).innerJoin(tripRecords, eq(tripMemberRecords.tripId, tripRecords.id)).where(eq(tripMemberRecords.memberId, memberId)).orderBy(desc(tripRecords.startDate)); }
export async function linkKnowledgeToTrip(memberId: string, entryId: string, tripId: string) { const membership = (await getDb().select({ id: tripMemberRecords.tripId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.memberId, memberId), eq(tripMemberRecords.tripId, tripId))).limit(1))[0]; if (!membership) throw new Error("TRIP_FORBIDDEN"); await getDb().insert(knowledgeTripLinkRecords).values({ entryId, tripId, createdByMemberId: memberId, createdAt: new Date().toISOString() }).onConflictDoNothing(); }

export async function getMemberPersona(memberId: string) { const row = await getRuntimeEnv().DB.prepare("SELECT model_url modelUrl, preview_media_asset_id previewMediaAssetId, resource_version resourceVersion, display_config_json displayConfigJson FROM member_personas WHERE member_id=?").bind(memberId).first(); return row || null; }
