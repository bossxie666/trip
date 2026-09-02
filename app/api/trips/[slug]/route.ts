import { getCurrentMember, tripDeletionMemberId } from "@/services/auth.server";
import { deleteTrip, updateTrip, type UpdateTripInput } from "@/services/trip-repository.server";
import type { TripStatus } from "@/models/travel";

const statuses = new Set<TripStatus>(["inspiration", "planning", "completed"]);
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as Partial<UpdateTripInput> & { undated?: boolean };
    const title = body.title?.trim() || "", status = body.status || "planning";
    const cities = Array.isArray(body.cities) ? body.cities.map(String).map((city) => city.trim()).filter(Boolean) : [];
    const startDate = body.undated ? null : body.startDate || null, endDate = body.undated ? null : body.endDate || null;
    if (!title || !statuses.has(status)) return Response.json({ error: "请完整填写行程名称和状态。" }, { status: 400 });
    if ((startDate && !endDate) || (!startDate && endDate) || (startDate && endDate && endDate < startDate)) return Response.json({ error: "请检查行程日期。" }, { status: 400 });
    const trip = await updateTrip((await params).slug, { title, status, cities, startDate, endDate, people: Math.max(1, Math.floor(Number(body.people) || 1)), cover: body.cover?.trim() || null, memberIds: Array.isArray(body.memberIds) ? body.memberIds.map(String) : [] }, actor.id);
    return trip ? Response.json({ trip }) : Response.json({ error: "没有找到这条行程。" }, { status: 404 });
  } catch (error) { const code = error instanceof Error ? error.message : ""; const protectedTrip = code === "PROTECTED_TRIP"; const occupied = code.startsWith("TRIP_DATE_SHORTEN_BLOCKED:"); const memberBlocked = code.startsWith("TRIP_MEMBER_REMOVE_BLOCKED:"); return Response.json({ error: protectedTrip ? "上海 + 杭州是受保护行程，当前阶段不能编辑或删除。" : occupied ? `日期 ${code.split(":").slice(1).join(":")} 仍有规划内容。请先移动到其他 Day 或保留到“想去”，本次修改已取消。` : memberBlocked ? "该成员已关联预订、费用、Presence 或行程数据，不能直接移除。" : "保存失败，请重试。" }, { status: protectedTrip ? 403 : occupied || memberBlocked ? 409 : 500 }); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    if (actor.id !== tripDeletionMemberId) return Response.json({ error: "只有 nini 可以删除行程。" }, { status: 403 });
    return await deleteTrip((await params).slug) ? Response.json({ ok: true }) : Response.json({ error: "没有找到这条行程。" }, { status: 404 });
  } catch (error) { const protectedTrip = error instanceof Error && error.message === "PROTECTED_TRIP"; return Response.json({ error: protectedTrip ? "上海 + 杭州是受保护行程，不能删除。" : "删除失败，请重试。" }, { status: protectedTrip ? 403 : 500 }); }
}
