import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dayPresenceRecords, dayRecords, memberPresenceWindowRecords, memberRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { replaceDayPresence, type DayPresenceUpdate } from "@/services/presence-repository.server";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const { slug } = await params;
  const url = new URL(request.url), dayId = url.searchParams.get("dayId") || "";
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
  const day = dayId ? (await db.select({ id: dayRecords.id, title: dayRecords.title, date: dayRecords.date }).from(dayRecords).where(and(eq(dayRecords.id, dayId), eq(dayRecords.tripId, trip.id))).limit(1))[0] : null;
  if (!day) return Response.json({ error: "日期不属于当前行程。" }, { status: 400 });
  const members = await db.select({ id: tripMemberRecords.memberId, displayName: memberRecords.displayName }).from(tripMemberRecords).innerJoin(memberRecords, eq(memberRecords.id, tripMemberRecords.memberId)).where(eq(tripMemberRecords.tripId, trip.id));
  const rows = await db.select().from(tripMemberRecords).where(eq(tripMemberRecords.tripId, trip.id));
  const [windows, explicitRows] = await Promise.all([
    db.select().from(memberPresenceWindowRecords).where(eq(memberPresenceWindowRecords.tripId, trip.id)),
    db.select().from(dayPresenceRecords).where(and(eq(dayPresenceRecords.tripId, trip.id), eq(dayPresenceRecords.dayId, day.id))),
  ]);
  const timezone = (await db.select({ timezone: tripRecords.timezone }).from(tripRecords).where(eq(tripRecords.id, trip.id)).limit(1))[0]?.timezone || "Asia/Shanghai";
  const offset = timezone === "Asia/Shanghai" ? "+08:00" : timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
  const start = day.date ? new Date(`${day.date}T00:00:00${offset}`).getTime() : Number.NaN, end = start + 86_400_000;
  const details = Object.fromEntries(rows.map((row) => {
    const explicit = explicitRows.find((entry) => entry.memberId === row.memberId);
    if (explicit) return [row.memberId, { state: explicit.state, startsAt: explicit.startsAt, endsAt: explicit.endsAt }];
    const memberWindows = windows.filter((window) => window.memberId === row.memberId).map((window) => ({ start: Date.parse(window.startsAt), end: window.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt) }));
    const state = row.presenceCoverage !== "complete" || !Number.isFinite(start) ? "unknown" : memberWindows.some((window) => window.start <= start && end <= window.end) ? "present" : memberWindows.some((window) => window.start < end && window.end > start) ? "unknown" : "absent";
    return [row.memberId, { state, startsAt: null, endsAt: null }];
  }));
  return Response.json({ day: { id: day.id, title: day.title, date: day.date }, members, states: Object.fromEntries(Object.entries(details).map(([id, value]) => [id, value.state])), details });
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { dayId?: string; memberIds?: string[]; members?: DayPresenceUpdate[] };
    if (!body.dayId || (!Array.isArray(body.memberIds) && !Array.isArray(body.members))) return Response.json({ error: "缺少当天成员数据。" }, { status: 400 });
    const db = getDb();
    const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    const membership = (await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0];
    if (!membership) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    if (!(await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, body.dayId), eq(dayRecords.tripId, trip.id))).limit(1))[0]) return Response.json({ error: "日期不属于当前行程。" }, { status: 400 });
    const presence = await replaceDayPresence({ tripId: trip.id, dayId: body.dayId, memberIds: body.memberIds ? [...new Set(body.memberIds.map(String))] : undefined, members: body.members, actorMemberId: actor.id });
    return Response.json({ presence });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "MEMBER_NOT_IN_TRIP" ? 403 : code === "DAY_CONTEXT_INCOMPLETE" || code === "PRESENCE_OVERLAP" ? 409 : 400;
    const message = status === 403 ? "你不是这条行程的成员。" : status === 409 ? "当天已有不完整的在场区间，请先整理后再确认。" : code === "INVALID_PRESENCE_RANGE" ? "部分在场的时间范围无效。" : code === "INVALID_PRESENCE_TIME" ? "请输入有效的时间。" : "当天成员数据无效。";
    return Response.json({ error: message, code: code || "INVALID_PRESENCE_STATE" }, { status });
  }
}
