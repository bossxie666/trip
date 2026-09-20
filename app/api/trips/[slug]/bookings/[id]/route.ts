import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { createAmapPlace } from "@/services/place-repository.server";
import { deleteBooking, updateBooking, type UpdateBookingInput } from "@/services/booking-repository.server";

type PlaceInput = { placeId?: string | null; providerPlaceId?: string | null } | null;

async function assertBookingAccess(slug: string, bookingId: string, actorId: string) {
  const db = getDb();
  const row = (await db.select({ booking: bookingRecords, trip: tripRecords }).from(bookingRecords).innerJoin(tripRecords, eq(tripRecords.id, bookingRecords.tripId)).where(and(eq(tripRecords.slug, slug), eq(bookingRecords.id, bookingId))).limit(1))[0];
  if (!row) throw new Error("BOOKING_NOT_IN_TRIP");
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, row.trip.id), eq(tripMemberRecords.memberId, actorId))).limit(1))[0]) throw new Error("TRIP_MEMBER_REQUIRED");
  return row;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const { slug, id } = await params;
    const row = await assertBookingAccess(slug, id, actor.id);
    const body = await request.json() as UpdateBookingInput & { place?: PlaceInput; origin?: PlaceInput; destination?: PlaceInput };
    const resolvePlace = async (value: PlaceInput | undefined, fallback: string | null | undefined) => {
      if (value === undefined) return fallback ?? null;
      if (!value) return null;
      return value.placeId || (value.providerPlaceId ? (await createAmapPlace(slug, { providerPlaceId: value.providerPlaceId }, actor.id)).id : null);
    };
    const input: UpdateBookingInput = { ...body };
    delete (input as typeof input & { place?: PlaceInput }).place;
    delete (input as typeof input & { origin?: PlaceInput }).origin;
    delete (input as typeof input & { destination?: PlaceInput }).destination;
    input.placeId = await resolvePlace(Object.prototype.hasOwnProperty.call(body, "place") ? body.place : undefined, row.booking.placeId);
    input.originPlaceId = await resolvePlace(Object.prototype.hasOwnProperty.call(body, "origin") ? body.origin : undefined, row.booking.originPlaceId);
    input.destinationPlaceId = await resolvePlace(Object.prototype.hasOwnProperty.call(body, "destination") ? body.destination : undefined, row.booking.destinationPlaceId);
    if (Object.prototype.hasOwnProperty.call(body, "origin")) input.originLabel = null;
    if (Object.prototype.hasOwnProperty.call(body, "destination")) input.destinationLabel = null;
    const booking = await updateBooking(id, input, actor.id, slug);
    return Response.json({ booking });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "TRIP_MEMBER_REQUIRED" ? 403 : code === "BOOKING_NOT_FOUND" || code === "BOOKING_NOT_IN_TRIP" ? 404 : code.startsWith("COST_ALLOCATION_UNBALANCED") ? 409 : 400;
    const allocated = code.split(":")[1];
    return Response.json({ error: status === 409 ? `订单金额已变化，当前费用分摊合计仍为 ¥${(Number(allocated || 0) / 100).toFixed(2)}。` : "住宿或交通更新失败，请检查后重试。", code }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const { slug, id } = await params;
    await assertBookingAccess(slug, id, actor.id);
    await deleteBooking(id);
    return Response.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "TRIP_MEMBER_REQUIRED" ? 403 : code === "BOOKING_NOT_IN_TRIP" ? 404 : 400;
    return Response.json({ error: "订单删除失败，请重试。", code }, { status });
  }
}
