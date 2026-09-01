import { getCurrentMember } from "@/services/auth.server";
import { updateBooking, type UpdateBookingInput } from "@/services/booking-repository.server";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const routeParams = await params;
    const body = await request.json() as UpdateBookingInput;
    const booking = await updateBooking(routeParams.id, body, actor.id, routeParams.slug);
    return Response.json({ booking });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "BOOKING_NOT_FOUND" ? 404 : code === "TRIP_MEMBER_REQUIRED" ? 403 : code === "BOOKING_NOT_IN_TRIP" ? 404 : code === "BOOKING_PLACE_NOT_IN_TRIP_CITY" ? 400 : code.startsWith("COST_ALLOCATION_UNBALANCED") ? 409 : 400;
    const allocated = code.split(":")[1];
    return Response.json({ error: status === 409 ? `订单金额已变化，当前费用分摊合计仍为 ¥${(Number(allocated || 0) / 100).toFixed(2)}，需要重新调整费用分摊。` : "订单更新失败，请检查后重试。", code }, { status });
  }
}
