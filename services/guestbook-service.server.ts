import { and, eq, inArray } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { mediaAssetRecords } from "@/db/schema";

export type GuestbookPerson = { id: string; displayName: string; avatar: string | null };
export type GuestbookMessageView = {
  id: string; body: string | null; createdAt: string; updatedAt: string;
  author: GuestbookPerson;
  media: { id: string; width: number | null; height: number | null }[];
  visibility: "all" | "selected"; memberIds: string[];
  likes: GuestbookPerson[];
  replies: { id: string; body: string; createdAt: string; author: GuestbookPerson }[];
};
// Filter before LIMIT, and use the same predicate for reads and social writes.
const access = "m.deleted_at IS NULL AND (m.visibility='all' OR m.author_member_id=? OR EXISTS (SELECT 1 FROM guestbook_message_members gm WHERE gm.message_id=m.id AND gm.member_id=?))";
export async function canAccessGuestbookMessage(id: string, memberId: string) {
  return Boolean(await getRuntimeEnv().DB.prepare(`SELECT m.id FROM guestbook_messages m WHERE m.id=? AND ${access}`).bind(id, memberId, memberId).first());
}
export async function listGuestbookMessages(memberId: string, limit = 24, messageId?: string): Promise<GuestbookMessageView[]> {
  const db = getRuntimeEnv().DB;
  type Row = { id: string; body: string | null; createdAt: string; updatedAt: string; visibility: "all" | "selected"; authorId: string; authorName: string; authorAvatar: string | null };
  const rows = (await db.prepare(`SELECT m.id,m.body,m.created_at AS createdAt,m.updated_at AS updatedAt,m.visibility,u.id AS authorId,u.display_name AS authorName,u.avatar AS authorAvatar FROM guestbook_messages m JOIN members u ON u.id=m.author_member_id WHERE ${access} ${messageId ? "AND m.id=?" : ""} ORDER BY m.created_at DESC,m.id LIMIT ?`).bind(memberId, memberId, ...(messageId ? [messageId] : []), Math.min(Math.max(limit, 1), 50)).all<Row>()).results;
  if (!rows.length) return [];
  const ids = rows.map(r => r.id), placeholders = ids.map(() => "?").join(",");
  const [media, members, likes, replies] = await Promise.all([
    db.prepare(`SELECT mm.message_id AS messageId,a.id,a.width,a.height FROM guestbook_message_media mm JOIN media_assets a ON a.id=mm.media_asset_id WHERE mm.message_id IN (${placeholders}) AND a.status='ready' ORDER BY mm.sort_order`).bind(...ids).all<{ messageId: string; id: string; width: number | null; height: number | null }>(),
    db.prepare(`SELECT message_id AS messageId,member_id AS memberId FROM guestbook_message_members WHERE message_id IN (${placeholders})`).bind(...ids).all<{ messageId: string; memberId: string }>(),
    db.prepare(`SELECT l.message_id AS messageId,u.id,u.display_name AS displayName,u.avatar FROM guestbook_likes l JOIN members u ON u.id=l.member_id WHERE l.message_id IN (${placeholders}) ORDER BY l.created_at,u.id`).bind(...ids).all<GuestbookPerson & { messageId: string }>(),
    db.prepare(`SELECT r.id,r.message_id AS messageId,r.body,r.created_at AS createdAt,u.id AS authorId,u.display_name AS authorName,u.avatar AS authorAvatar FROM guestbook_replies r JOIN members u ON u.id=r.author_member_id WHERE r.message_id IN (${placeholders}) AND r.deleted_at IS NULL ORDER BY r.created_at,r.id`).bind(...ids).all<{ id: string; messageId: string; body: string; createdAt: string; authorId: string; authorName: string; authorAvatar: string | null }>(),
  ]);
  return rows.map(r => ({ id: r.id, body: r.body, createdAt: r.createdAt, updatedAt: r.updatedAt, visibility: r.visibility,
    author: { id: r.authorId, displayName: r.authorName, avatar: r.authorAvatar },
    memberIds: members.results.filter(m => m.messageId === r.id).map(m => m.memberId),
    media: media.results.filter(m => m.messageId === r.id).map(({ id, width, height }) => ({ id, width, height })),
    likes: likes.results.filter(l => l.messageId === r.id).map(({ id, displayName, avatar }) => ({ id, displayName, avatar })),
    replies: replies.results.filter(reply => reply.messageId === r.id).map(reply => ({ id: reply.id, body: reply.body, createdAt: reply.createdAt, author: { id: reply.authorId, displayName: reply.authorName, avatar: reply.authorAvatar } })),
  }));
}
async function messageView(actor: string, id: string) {
  const message = (await listGuestbookMessages(actor, 1, id))[0];
  if (!message) throw new Error("GUESTBOOK_NOT_FOUND");
  return message;
}
function text(value: unknown) {
  if (value != null && typeof value !== "string") throw new Error("GUESTBOOK_INVALID");
  const body = typeof value === "string" ? value.trim() || null : null;
  if (body && body.length > 1000) throw new Error("GUESTBOOK_BODY_TOO_LONG");
  return body;
}
async function audience(owner: string, visibility: unknown, value: unknown) {
  if (visibility !== "all" && visibility !== "selected") throw new Error("INVALID_GUESTBOOK_MEMBERS");
  if (value !== undefined && (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== "string"))) throw new Error("INVALID_GUESTBOOK_MEMBERS");
  const ids = [...new Set([owner, ...(visibility === "selected" ? value as string[] || [] : [])])];
  const members = await getRuntimeEnv().DB.prepare(`SELECT id FROM members WHERE active=1 AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
  if (members.results.length !== ids.length) throw new Error("INVALID_GUESTBOOK_MEMBERS");
  return { visibility, ids };
}
async function validateMessageMedia(actor: string, value: unknown): Promise<string[]> {
  if (!Array.isArray(value) || value.length > 3 || value.some(id => typeof id !== "string") || new Set(value).size !== value.length) throw new Error("INVALID_GUESTBOOK_MEDIA");
  if (!value.length) return [];
  const rows = await getDb().select({ id: mediaAssetRecords.id }).from(mediaAssetRecords).where(and(inArray(mediaAssetRecords.id, value), eq(mediaAssetRecords.uploaderMemberId, actor), eq(mediaAssetRecords.purpose, "guestbook"), eq(mediaAssetRecords.status, "ready")));
  if (rows.length !== value.length) throw new Error("INVALID_GUESTBOOK_MEDIA");
  return value;
}
export async function createGuestbookMessage(actor: string, raw: unknown, rawMedia: unknown = [], visibility: unknown = "all", memberIds?: unknown) {
  const body = text(raw), media = await validateMessageMedia(actor, rawMedia);
  if (!body && !media.length) throw new Error("GUESTBOOK_EMPTY");
  const selected = await audience(actor, visibility, memberIds), id = crypto.randomUUID(), now = new Date().toISOString(), db = getRuntimeEnv().DB;
  await db.batch([
    db.prepare("INSERT INTO guestbook_messages (id,author_member_id,body,created_at,updated_at,visibility) VALUES (?,?,?,?,?,?)").bind(id, actor, body, now, now, selected.visibility),
    ...selected.ids.map(member => db.prepare("INSERT INTO guestbook_message_members (message_id,member_id) VALUES (?,?)").bind(id, member)),
    ...media.map((asset, order) => db.prepare("INSERT INTO guestbook_message_media (message_id,media_asset_id,sort_order) VALUES (?,?,?)").bind(id, asset, order)),
  ]);
  return messageView(actor, id);
}
async function ownMessage(actor: string, id: string) {
  const row = await getRuntimeEnv().DB.prepare("SELECT author_member_id AS author,visibility FROM guestbook_messages WHERE id=? AND deleted_at IS NULL").bind(id).first<{ author: string; visibility: string }>();
  if (!row) throw new Error("GUESTBOOK_NOT_FOUND");
  if (row.author !== actor) throw new Error("GUESTBOOK_OWNER_REQUIRED");
  return row;
}
export async function updateGuestbookMessage(actor: string, id: string, raw: unknown, visibility?: unknown, memberIds?: unknown) {
  const existing = await ownMessage(actor, id), body = text(raw), db = getRuntimeEnv().DB;
  if (!body && !await db.prepare("SELECT message_id FROM guestbook_message_media WHERE message_id=? LIMIT 1").bind(id).first()) throw new Error("GUESTBOOK_EMPTY");
  const selected = visibility === undefined && memberIds === undefined ? null : await audience(actor, visibility ?? existing.visibility, memberIds);
  await db.batch([
    db.prepare("UPDATE guestbook_messages SET body=?,updated_at=? WHERE id=?").bind(body, new Date().toISOString(), id),
    ...(selected ? [db.prepare("UPDATE guestbook_messages SET visibility=? WHERE id=?").bind(selected.visibility, id),
      db.prepare("DELETE FROM guestbook_message_members WHERE message_id=?").bind(id),
      ...selected.ids.map(member => db.prepare("INSERT INTO guestbook_message_members (message_id,member_id) VALUES (?,?)").bind(id, member))] : []),
  ]);
  return messageView(actor, id);
}
export async function deleteGuestbookMessage(actor: string, id: string) {
  await ownMessage(actor, id);
  const now = new Date().toISOString();
  await getRuntimeEnv().DB.prepare("UPDATE guestbook_messages SET deleted_at=?,updated_at=? WHERE id=?").bind(now, now, id).run();
  return true;
}
export async function setGuestbookLike(actor: string, id: string, liked: unknown) {
  if (typeof liked !== "boolean") throw new Error("GUESTBOOK_INVALID");
  if (!await canAccessGuestbookMessage(id, actor)) throw new Error("GUESTBOOK_NOT_FOUND");
  const db = getRuntimeEnv().DB;
  if (liked) await db.prepare(`INSERT OR IGNORE INTO guestbook_likes (message_id,member_id,created_at) SELECT m.id,?,? FROM guestbook_messages m WHERE m.id=? AND ${access}`).bind(actor, new Date().toISOString(), id, actor, actor).run();
  else await db.prepare("DELETE FROM guestbook_likes WHERE message_id=? AND member_id=?").bind(id, actor).run();
  return messageView(actor, id);
}
export async function createGuestbookReply(actor: string, id: string, raw: unknown) {
  const body = text(raw);
  if (!body) throw new Error("GUESTBOOK_REPLY_INVALID");
  if (!await canAccessGuestbookMessage(id, actor)) throw new Error("GUESTBOOK_NOT_FOUND");
  await getRuntimeEnv().DB.prepare(`INSERT INTO guestbook_replies (id,message_id,author_member_id,body,created_at) SELECT ?,m.id,?,?,? FROM guestbook_messages m WHERE m.id=? AND ${access}`).bind(crypto.randomUUID(), actor, body, new Date().toISOString(), id, actor, actor).run();
  return messageView(actor, id);
}
export async function deleteGuestbookReply(actor: string, id: string, replyId: string) {
  if (!await canAccessGuestbookMessage(id, actor)) throw new Error("GUESTBOOK_NOT_FOUND");
  const db = getRuntimeEnv().DB;
  const reply = await db.prepare("SELECT author_member_id AS author FROM guestbook_replies WHERE id=? AND message_id=? AND deleted_at IS NULL").bind(replyId, id).first<{ author: string }>();
  if (!reply) throw new Error("GUESTBOOK_NOT_FOUND");
  if (reply.author !== actor) throw new Error("GUESTBOOK_REPLY_OWNER_REQUIRED");
  await db.prepare("UPDATE guestbook_replies SET deleted_at=? WHERE id=? AND message_id=?").bind(new Date().toISOString(), replyId, id).run();
  return messageView(actor, id);
}
