import { getCurrentMember } from "@/services/auth.server";
import { deleteItineraryItem, replaceItineraryParticipantOverrides, updateItineraryItem } from "@/services/itinerary-repository.server";
import { getDb } from "@/db";
import { and, eq } from "drizzle-orm";
import { dayPresenceRecords, dayRecords, itineraryItemParticipantOverrideRecords, itineraryItemRecords, memberPresenceWindowRecords, memberRecords, tripMemberRecords, tripRecords } from "@/db/schema";

async function tripIdForSlug(slug: string) {
  return (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0]?.id;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const { slug, id } = await params, tripId = await tripIdForSlug(slug);
  if (!tripId) return Response.json({ error: "行程不存在。" }, { status: 404 });
  const db = getDb();
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
  const item = (await db.select({ dayId: itineraryItemRecords.dayId, startTimeLocal: itineraryItemRecords.startTimeLocal }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.id, id), eq(itineraryItemRecords.tripId, tripId))).limit(1))[0];
  if (!item) return Response.json({ error: "行程事项不存在。" }, { status: 404 });
  const [members, overrides, day, trip, presenceRows, windows, dayPresence] = await Promise.all([
    db.select({ id: tripMemberRecords.memberId, displayName: memberRecords.displayName }).from(tripMemberRecords).innerJoin(memberRecords, eq(memberRecords.id, tripMemberRecords.memberId)).where(eq(tripMemberRecords.tripId, tripId)),
    db.select().from(itineraryItemParticipantOverrideRecords).where(eq(itineraryItemParticipantOverrideRecords.itineraryItemId, id)),
    db.select({ date: dayRecords.date }).from(dayRecords).where(and(eq(dayRecords.id, item.dayId), eq(dayRecords.tripId, tripId))).limit(1),
    db.select({ timezone: tripRecords.timezone }).from(tripRecords).where(eq(tripRecords.id, tripId)).limit(1),
    db.select().from(tripMemberRecords).where(eq(tripMemberRecords.tripId, tripId)),
    db.select().from(memberPresenceWindowRecords).where(eq(memberPresenceWindowRecords.tripId, tripId)),
    db.select().from(dayPresenceRecords).where(and(eq(dayPresenceRecords.tripId, tripId), eq(dayPresenceRecords.dayId, item.dayId))),
  ]);
  const overrideMap = Object.fromEntries(overrides.map((entry) => [entry.memberId, entry.participation]));
  const offset = trip[0]?.timezone === "Asia/Shanghai" ? "+08:00" : trip[0]?.timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
  const dayStart = day[0]?.date ? new Date(`${day[0].date}T00:00:00${offset}`).getTime() : Number.NaN, dayEnd = dayStart + 86_400_000;
  const states = Object.fromEntries(presenceRows.map((row) => {
    const explicit = dayPresence.find((entry) => entry.memberId === row.memberId);
    if (explicit) {
      if (explicit.state === "present") return [row.memberId, "present"];
      if (explicit.state === "absent") return [row.memberId, "absent"];
      if (!Number.isFinite(dayStart) || (!explicit.startsAt && !explicit.endsAt)) return [row.memberId, "unknown"];
      const starts = explicit.startsAt ? Date.parse(explicit.startsAt) : dayStart;
      const ends = explicit.endsAt ? Date.parse(explicit.endsAt) : dayEnd;
      if (!item.startTimeLocal) return [row.memberId, "unknown"];
      const instant = day[0]?.date ? Date.parse(`${day[0].date}T${item.startTimeLocal}:00${offset}`) : Number.NaN;
      return [row.memberId, Number.isFinite(instant) && starts <= instant && instant < ends ? "present" : "absent"];
    }
    const memberWindows = windows.filter((window) => window.memberId === row.memberId).map((window) => ({ start: Date.parse(window.startsAt), end: window.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt) }));
    const instant = item.startTimeLocal && day[0]?.date ? Date.parse(`${day[0].date}T${item.startTimeLocal}:00${offset}`) : Number.NaN;
    const state = row.presenceCoverage !== "complete" ? "unknown" : Number.isFinite(instant) ? memberWindows.some((window) => window.start <= instant && instant < window.end) ? "present" : "absent" : memberWindows.some((window) => window.start <= dayStart && dayEnd <= window.end) ? "present" : memberWindows.some((window) => window.start < dayEnd && window.end > dayStart) ? "unknown" : "absent";
    return [row.memberId, state];
  }));
  return Response.json({ members, overrides: overrideMap, states });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug, id } = await params, tripId = await tripIdForSlug(slug);
    if (!tripId) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const body = await request.json() as { title?: string; note?: string | null; placeId?: string | null; startTimeLocal?: string | null; endTimeLocal?: string | null; timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours"; openingHoursNote?: string | null; durationMinutes?: number | null; dayId?: string; participantMemberIds?: string[] | null };
    const item = await updateItineraryItem(tripId, id, body, actor.id);
    if (Object.prototype.hasOwnProperty.call(body, "participantMemberIds")) await replaceItineraryParticipantOverrides({ tripId, itineraryItemId: id, memberIds: body.participantMemberIds == null ? null : [...new Set(body.participantMemberIds.map(String))], actorMemberId: actor.id });
    return Response.json({ item });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "ITINERARY_ITEM_NOT_FOUND" ? 404 : code === "ITINERARY_ITEM_LOCKED" ? 409 : code === "MEMBER_NOT_IN_TRIP" ? 403 : code === "DAY_NOT_IN_TRIP" || code === "ITEM_PLACE_NOT_IN_TRIP_CITY" || code.startsWith("INVALID_") || code === "ITINERARY_TITLE_REQUIRED" ? 400 : 500;
    return Response.json({ error: status === 404 ? "行程事项不存在。" : status === 409 ? "已锁定事项需先解锁才能移动。" : status === 403 ? "你不是这条行程的成员。" : status === 400 ? "行程事项内容无效。" : "更新失败，请重试。" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug, id } = await params, tripId = await tripIdForSlug(slug);
    if (!tripId) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, tripId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    await deleteItineraryItem(tripId, id);
    return Response.json({ deleted: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "ITINERARY_ITEM_NOT_FOUND" ? "行程事项不存在。" : "删除失败，请重试。" }, { status: code === "ITINERARY_ITEM_NOT_FOUND" ? 404 : 500 });
  }
}
