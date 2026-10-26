import { and, eq, isNull } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { dayRecords, knowledgeEntryRecords, knowledgePlaceLinkRecords, placeRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { apiError, hasValidRequestOrigin, requestIdFrom } from "@/services/api-response";
import { recordAuditEvent } from "@/services/audit.server";

async function context(request: Request, slug: string) {
  const actor = await getCurrentMember();
  if (!actor) return { response: apiError(request, 401, "UNAUTHORIZED", "请先登录。") };
  if (!hasValidRequestOrigin(request)) return { response: apiError(request, 403, "INVALID_ORIGIN", "请求来源无效。") };
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) return { response: apiError(request, 404, "TRIP_NOT_FOUND", "行程不存在。") };
  const member = (await db.select({ id: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0];
  if (!member) return { response: apiError(request, 403, "TRIP_FORBIDDEN", "你不是这条行程的成员。") };
  return { actor, trip };
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await context(request, (await params).slug);
  if (access.response) return access.response;
  const { actor, trip } = access;
  let body: { entryId?: string; dayId?: string; placeIds?: string[] };
  try { body = await request.json(); }
  catch { return apiError(request, 400, "INVALID_BODY", "请求内容无效。"); }
  if (!body || typeof body.entryId !== "string" || typeof body.dayId !== "string" || (body.placeIds !== undefined && (!Array.isArray(body.placeIds) || body.placeIds.length > 50 || body.placeIds.some((id) => typeof id !== "string")))) return apiError(request, 400, "INVALID_KNOWLEDGE_LINK", "请选择有效的攻略、日期和地点。");
  const db = getDb();
  const [days, entries] = await Promise.all([
    db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, body.dayId), eq(dayRecords.tripId, trip.id))).limit(1),
    db.select().from(knowledgeEntryRecords).where(and(eq(knowledgeEntryRecords.id, body.entryId), isNull(knowledgeEntryRecords.deletedAt))).limit(1),
  ]);
  const day = days[0], entry = entries[0];
  if (!day || !entry) return apiError(request, 400, "INVALID_KNOWLEDGE_LINK", "请选择有效的攻略和日期。");
  const places = await db.select({ id: placeRecords.id, name: placeRecords.name }).from(knowledgePlaceLinkRecords).innerJoin(placeRecords, eq(knowledgePlaceLinkRecords.placeId, placeRecords.id)).where(eq(knowledgePlaceLinkRecords.entryId, entry.id)).orderBy(knowledgePlaceLinkRecords.sortOrder);
  const requested = body.placeIds === undefined ? new Set(places.map((place) => place.id)) : new Set(body.placeIds);
  if ([...requested].some((id) => !places.some((place) => place.id === id))) return apiError(request, 400, "INVALID_KNOWLEDGE_PLACES", "所选地点不属于这条知识，请重新选择。");
  const selected = places.filter((place) => requested.has(place.id));
  const items = (selected.length ? selected : [{ id: null, name: entry.title }]).map((place) => ({ id: crypto.randomUUID(), title: place.name, placeId: place.id }));
  const now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
  const statements: D1PreparedStatement[] = [], itemIndexes: number[] = [];
  for (const item of items) {
    if (item.placeId) statements.push(d1.prepare("INSERT OR IGNORE INTO trip_cities (trip_id,city_id,position) SELECT ?,city_id,COALESCE((SELECT MAX(position)+1 FROM trip_cities WHERE trip_id=?),0) FROM places WHERE id=?").bind(trip.id, trip.id, item.placeId));
    itemIndexes.push(statements.length);
    statements.push(d1.prepare("INSERT INTO itinerary_items (id,trip_id,day_id,knowledge_entry_id,place_id,item_type,title,time_mode,sort_order,created_by_member_id,updated_by_member_id,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'untimed',COALESCE((SELECT MAX(sort_order) FROM itinerary_items WHERE day_id=?),0)+1,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM itinerary_items WHERE trip_id=? AND day_id=? AND knowledge_entry_id=? AND place_id IS ?) RETURNING id").bind(item.id, trip.id, day.id, entry.id, item.placeId, item.placeId ? "place" : "activity", item.title, day.id, actor.id, actor.id, now, now, trip.id, day.id, entry.id, item.placeId));
  }
  statements.push(d1.prepare("INSERT INTO knowledge_trip_links (entry_id,trip_id,created_by_member_id,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING").bind(entry.id, trip.id, actor.id, now));
  try {
    const results = await d1.batch(statements);
    const count = itemIndexes.reduce((total, index) => total + (results[index]?.results?.length || 0), 0);
    await recordAuditEvent({ memberId: actor.id, action: "knowledge.add_to_day", resourceType: "knowledge", resourceId: entry.id, requestId: requestIdFrom(request), metadata: { tripId: trip.id, dayId: day.id, itemCount: count } });
    return Response.json({ ok: true, count, alreadyAdded: count === 0 });
  } catch { return apiError(request, 500, "KNOWLEDGE_LINK_FAILED", "添加失败，请重试。"); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const access = await context(request, (await params).slug);
  if (access.response) return access.response;
  let body: { itemId?: string };
  try { body = await request.json(); }
  catch { return apiError(request, 400, "INVALID_BODY", "请求内容无效。"); }
  if (!body || typeof body.itemId !== "string") return apiError(request, 400, "ITEM_REQUIRED", "请选择行程事项。");
  const { actor, trip } = access;
  const result = await getRuntimeEnv().DB.prepare("UPDATE itinerary_items SET title=COALESCE(knowledge_title_override,(SELECT name FROM places WHERE id=itinerary_items.place_id),(SELECT title FROM knowledge_entries WHERE id=itinerary_items.knowledge_entry_id),title),knowledge_entry_id=NULL,knowledge_title_override=NULL,recommendation_id=NULL,updated_by_member_id=?,updated_at=? WHERE id=? AND trip_id=? AND knowledge_entry_id IS NOT NULL RETURNING id").bind(actor.id, new Date().toISOString(), body.itemId, trip.id).all();
  if (!result.results?.length) return apiError(request, 404, "KNOWLEDGE_LINK_NOT_FOUND", "关联不存在或已经解除。");
  await recordAuditEvent({ memberId: actor.id, action: "knowledge.detach_item", resourceType: "itinerary_item", resourceId: body.itemId, requestId: requestIdFrom(request), metadata: { tripId: trip.id } });
  return Response.json({ ok: true });
}
