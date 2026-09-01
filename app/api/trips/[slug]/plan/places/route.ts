import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { createAmapPlace, createManualPlace } from "@/services/place-repository.server";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const { slug } = await params;
    const body = await request.json() as { name?: string; providerPlaceId?: string; cityId?: string; address?: string | null; longitude?: number | null; latitude?: number | null };
    const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
    if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
    if (!(await getDb().select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
    if (!body.cityId) return Response.json({ error: "请选择地点所属城市。" }, { status: 400 });
    if (body.providerPlaceId) {
      const place = await createAmapPlace(slug, { providerPlaceId: body.providerPlaceId, cityId: body.cityId }, actor.id);
      return Response.json({ place }, { status: 201 });
    }
    if (!body.name?.trim()) return Response.json({ error: "请填写地点名称。" }, { status: 400 });
    const place = await createManualPlace(slug, { name: body.name.trim(), cityId: body.cityId, address: body.address?.trim() || null, longitude: body.longitude ?? null, latitude: body.latitude ?? null }, actor.id);
    return Response.json({ place }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "TRIP_NOT_FOUND" ? 404 : code === "CITY_NOT_IN_TRIP" || code.startsWith("INVALID_") ? 400 : 500;
    return Response.json({ error: status === 400 ? "手动地点信息无效。" : "手动地点保存失败，请重试。" }, { status });
  }
}
