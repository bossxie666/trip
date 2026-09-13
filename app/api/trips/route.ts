import { createTrip, listTrips, type CreateTripInput } from "@/services/trip-repository.server";
import type { TripStatus } from "@/models/travel";
import { getCurrentMember } from "@/services/auth.server";

const readableStatuses = new Set<TripStatus | "all">(["all", "inspiration", "planning", "completed"]);
const creatableStatuses = new Set<CreateTripInput["status"]>(["inspiration", "planning", "completed"]);

export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("status") || "all";
    const status = readableStatuses.has(requested as TripStatus | "all") ? requested as TripStatus | "all" : "all";
    return Response.json({ trips: await listTrips(status) });
  } catch {
    return Response.json({ error: "行程数据暂时无法读取，请稍后重试。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as Partial<CreateTripInput> & { undated?: boolean };
    const title = body.title?.trim() || "";
    const status = body.status || "planning";
    const cities = Array.isArray(body.cities) ? body.cities.map(String).map((city) => city.trim()).filter(Boolean) : [];
    const people = Number.isFinite(Number(body.people)) ? Math.max(1, Math.floor(Number(body.people))) : 1;
    const startDate = body.undated ? null : body.startDate || null;
    const endDate = body.undated ? null : body.endDate || null;
    const cover = body.cover?.trim() || null;
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(String) : [];

    if (!title) return Response.json({ error: "请填写行程名称。" }, { status: 400 });
    if (!creatableStatuses.has(status as CreateTripInput["status"])) return Response.json({ error: "请选择有效的行程状态。" }, { status: 400 });
    if ((startDate && !endDate) || (!startDate && endDate)) return Response.json({ error: "请同时填写开始和结束日期，或选择日期未定。" }, { status: 400 });
    if (startDate && endDate && endDate < startDate) return Response.json({ error: "结束日期不能早于开始日期。" }, { status: 400 });

    const trip = await createTrip({ title, status: status as CreateTripInput["status"], cities, startDate, endDate, people: Math.max(1, memberIds.length || people), cover, memberIds }, actor.id);
    return Response.json({ trip }, { status: 201 });
  } catch {
    return Response.json({ error: "创建失败，行程没有保存，请重试。" }, { status: 500 });
  }
}
