import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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

export type KnowledgeFilters = { section?: string; q?: string; tag?: string; destination?: string; favorite?: boolean; page?: number; pageSize?: number };

// instr treats %, _ and backslashes literally, unlike an unescaped LIKE pattern.
export function knowledgeSearchCondition(query: string) {
  const term = query.trim().slice(0, 80).toLocaleLowerCase("zh-CN");
  return sql`(instr(lower(coalesce(${knowledgeEntryRecords.title}, '') || ' ' || coalesce(${knowledgeEntryRecords.body}, '') || ' ' || coalesce(${knowledgeEntryRecords.summary}, '') || ' ' || coalesce(${knowledgeEntryRecords.destination}, '')), ${term}) > 0 OR EXISTS (SELECT 1 FROM knowledge_entry_tags et JOIN knowledge_tags t ON t.id=et.tag_id WHERE et.entry_id=${knowledgeEntryRecords.id} AND instr(t.normalized_name, ${term}) > 0))`;
}

export async function listKnowledgePage(memberId: string, filters: KnowledgeFilters = {}) {
  const db = getDb(), section = safeSection(filters.section), q = filters.q?.trim();
  const page = Number.isSafeInteger(filters.page) && filters.page! > 0 ? Math.min(filters.page!, 100000) : 1;
  // Keep related IN queries below D1's bound parameter limit.
  const pageSize = Number.isSafeInteger(filters.pageSize) ? Math.min(80, Math.max(1, filters.pageSize!)) : 40;
  const clauses = [isNull(knowledgeEntryRecords.deletedAt)];
  if (section) clauses.push(eq(knowledgeEntryRecords.section, section));
  if (q) clauses.push(knowledgeSearchCondition(q));
  if (filters.destination?.trim()) clauses.push(sql`instr(lower(coalesce(${knowledgeEntryRecords.destination}, '')), ${filters.destination.trim().slice(0, 80).toLocaleLowerCase("zh-CN")}) > 0`);
  if (filters.favorite) clauses.push(sql`EXISTS (SELECT 1 FROM knowledge_favorites f WHERE f.entry_id=${knowledgeEntryRecords.id} AND f.member_id=${memberId})`);
  if (filters.tag) clauses.push(sql`EXISTS (SELECT 1 FROM knowledge_entry_tags et JOIN knowledge_tags t ON t.id=et.tag_id WHERE et.entry_id=${knowledgeEntryRecords.id} AND t.normalized_name=${filters.tag.trim().toLocaleLowerCase("zh-CN")})`);
  const fetched = await db.select({ entry: knowledgeEntryRecords, authorName: memberRecords.displayName }).from(knowledgeEntryRecords).leftJoin(memberRecords, eq(knowledgeEntryRecords.createdByMemberId, memberRecords.id)).where(and(...clauses)).orderBy(desc(knowledgeEntryRecords.updatedAt), desc(knowledgeEntryRecords.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
  const hasMore = fetched.length > pageSize, rows = fetched.slice(0, pageSize);
  if (!rows.length) return { entries: [] as KnowledgeEntryView[], page, hasMore: false };
  const ids = rows.map(({ entry }) => entry.id);
  const [tagRows, mediaRows, favorites] = await Promise.all([
    db.select({ entryId: knowledgeEntryTagRecords.entryId, name: knowledgeTagRecords.name }).from(knowledgeEntryTagRecords).innerJoin(knowledgeTagRecords, eq(knowledgeEntryTagRecords.tagId, knowledgeTagRecords.id)).where(inArray(knowledgeEntryTagRecords.entryId, ids)),
    db.select({ entryId: knowledgeMediaRecords.entryId, assetId: knowledgeMediaRecords.mediaAssetId }).from(knowledgeMediaRecords).where(inArray(knowledgeMediaRecords.entryId, ids)).orderBy(knowledgeMediaRecords.sortOrder),
    db.select({ entryId: knowledgeFavoriteRecords.entryId }).from(knowledgeFavoriteRecords).where(and(eq(knowledgeFavoriteRecords.memberId, memberId), inArray(knowledgeFavoriteRecords.entryId, ids))),
  ]);
  const favoriteIds = new Set(favorites.map((item) => item.entryId));
  const entries = rows.map(({ entry, authorName }) => ({ ...entry, authorName, tags: tagRows.filter((tag) => tag.entryId === entry.id).map((tag) => tag.name), mediaAssetIds: mediaRows.filter((item) => item.entryId === entry.id).map((item) => item.assetId), favorite: favoriteIds.has(entry.id) }));
  return { entries, page, hasMore };
}

export async function listKnowledge(memberId: string, filters: KnowledgeFilters = {}) { return (await listKnowledgePage(memberId, filters)).entries; }

export async function listKnowledgeTags() {
  return getDb().selectDistinct({ name: knowledgeTagRecords.name }).from(knowledgeTagRecords)
    .innerJoin(knowledgeEntryTagRecords, eq(knowledgeEntryTagRecords.tagId, knowledgeTagRecords.id))
    .innerJoin(knowledgeEntryRecords, eq(knowledgeEntryRecords.id, knowledgeEntryTagRecords.entryId))
    .where(isNull(knowledgeEntryRecords.deletedAt)).orderBy(knowledgeTagRecords.normalizedName);
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
export async function linkKnowledgeToTrip(memberId: string, entryId: string, tripId: string) {
  const db = getDb();
  if (!(await db.select({ id: knowledgeEntryRecords.id }).from(knowledgeEntryRecords).where(and(eq(knowledgeEntryRecords.id, entryId), isNull(knowledgeEntryRecords.deletedAt))).limit(1))[0]) throw new Error("KNOWLEDGE_NOT_FOUND");
  const membership = (await db.select({ id: tripMemberRecords.tripId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.memberId, memberId), eq(tripMemberRecords.tripId, tripId))).limit(1))[0];
  if (!membership) throw new Error("TRIP_FORBIDDEN");
  await db.insert(knowledgeTripLinkRecords).values({ entryId, tripId, createdByMemberId: memberId, createdAt: new Date().toISOString() }).onConflictDoNothing();
}

export async function getMemberPersona(memberId: string) { const row = await getRuntimeEnv().DB.prepare("SELECT model_url modelUrl, preview_media_asset_id previewMediaAssetId, resource_version resourceVersion, display_config_json displayConfigJson FROM member_personas WHERE member_id=?").bind(memberId).first(); return row || null; }
