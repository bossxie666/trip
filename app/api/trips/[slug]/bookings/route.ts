import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { createBooking, createBookingCostLine, replaceCostAllocations } from "@/services/booking-repository.server";
import { createAmapPlace } from "@/services/place-repository.server";
import type { BookingStatus, BookingType } from "@/models/planning";
import { isTransportBooking } from "@/services/booking-semantics";

type PlaceInput = { placeId?: string | null; providerPlaceId?: string | null } | null;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const { slug } = await params;
    const body = await request.json() as { type?: BookingType; status?: BookingStatus; title?: string; provider?: string | null; startDateLocal?: string | null; endDateLocal?: string | null; startAt?: string | null; endAt?: string | null; place?: PlaceInput; origin?: PlaceInput; destination?: PlaceInput; originLabel?: string | null; destinationLabel?: string | null; totalAmountMinor?: number | null; participantMemberIds?: string[]; bookingReference?: string | null; notes?: string | null };
    const db = getDb();
    const trip = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await db.select().from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    const resolvePlace = async (value: PlaceInput) => value?.placeId || (value?.providerPlaceId ? (await createAmapPlace(slug, { providerPlaceId: value.providerPlaceId }, actor.id)).id : null);
    const [placeId, originPlaceId, destinationPlaceId] = await Promise.all([resolvePlace(body.place || null), resolvePlace(body.origin || null), resolvePlace(body.destination || null)]);
    const type = body.type || "other", status = body.status || "tentative", participantMemberIds = [...new Set((body.participantMemberIds || []).map(String))];
    const originLabel = body.originLabel?.trim() || null, destinationLabel = body.destinationLabel?.trim() || null;
    if (isTransportBooking({ type, originPlaceId, destinationPlaceId, originLabel, destinationLabel }) && (!originPlaceId || !destinationPlaceId)) return Response.json({ error: "班次 / 票务交通必须选择真实出发地与到达地。" }, { status: 400 });
    const booking = await createBooking({ tripId: trip.id, type, status, title: body.title?.trim() || (type === "hotel" ? "住宿安排" : `${originLabel || "起点待定"} → ${destinationLabel || "终点待定"}`), provider: body.provider?.trim() || null, temporalKind: type === "hotel" ? "date_range" : (body.endAt ? "interval" : "instant"), startAt: body.startAt || null, endAt: body.endAt || null, startDateLocal: body.startDateLocal || null, endDateLocal: body.endDateLocal || null, timezone: trip.timezone || "Asia/Shanghai", placeId, originPlaceId, destinationPlaceId, originLabel, destinationLabel, totalAmountMinor: body.totalAmountMinor ?? null, currency: body.totalAmountMinor == null ? null : "CNY", bookingReference: body.bookingReference?.trim() || null, notes: body.notes?.trim() || null, participantMemberIds }, actor.id);
    if (body.totalAmountMinor != null && body.totalAmountMinor >= 0 && participantMemberIds.length) {
      const line = await createBookingCostLine({ bookingId: booking.id, title: type === "hotel" ? "住宿总价" : "交通费用", serviceStartDate: body.startDateLocal || null, serviceEndDate: body.endDateLocal || body.startDateLocal || null, amountMinor: body.totalAmountMinor, currency: "CNY", allocationMode: "equal", sortOrder: 1 });
      await replaceCostAllocations(line.id, participantMemberIds);
    }
    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    console.error("generic booking create failed", { code });
    const bad = /REQUIRED|INVALID|NOT_IN_TRIP|NOT_FOUND/.test(code);
    return Response.json({ error: bad ? "请检查地点、日期、成员和金额。" : "保存预订失败，请重试。" }, { status: bad ? 400 : 500 });
  }
}
