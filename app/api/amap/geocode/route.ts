import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, tripCityRecords, tripMemberRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { classifyAmapError, geocodeAmapAddress } from "@/services/amap/amap-web-service.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    try {
      const limit = await consumeRateLimit("amap-geocode", actor.id, 60, 60 * 1000);
      if (!limit.allowed) return rateLimitResponse(limit, "地图查询过于频繁，请稍后再试。");
    } catch {
      return Response.json({ error: "地图安全服务暂时不可用，请稍后再试。" }, { status: 503 });
    }
    const body = await request.json() as { address?: string; cityId?: string }, address = body.address?.trim().slice(0, 160), cityId = body.cityId?.trim();
    if (!address || !cityId) return Response.json({ error: "请输入地址并选择城市。" }, { status: 400 });
    const city = (await getDb().select().from(cityRecords).where(eq(cityRecords.id, cityId)).limit(1))[0];
    if (!city) return Response.json({ error: "城市不存在。" }, { status: 404 });
    const visibleCity = (await getDb().select({ cityId: tripCityRecords.cityId }).from(tripCityRecords)
      .innerJoin(tripMemberRecords, eq(tripMemberRecords.tripId, tripCityRecords.tripId))
      .where(and(eq(tripCityRecords.cityId, cityId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0];
    if (!visibleCity) return Response.json({ error: "城市不属于你的行程。" }, { status: 403 });
    return Response.json({ result: await geocodeAmapAddress(address, city.name) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const classified = classifyAmapError(error, "geocode");
    return Response.json({ error: code === "AMAP_GEOCODE_NOT_FOUND" ? "没有找到这个地址，请补充区县或门牌号。" : classified.message, code: classified.code }, { status: code === "AMAP_GEOCODE_NOT_FOUND" ? 404 : classified.status });
  }
}
