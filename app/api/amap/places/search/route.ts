import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, tripCityRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { classifyAmapError, searchAmapPois } from "@/services/amap/amap-web-service.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentMember();
    if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    try {
      const limit = await consumeRateLimit("amap-places", actor.id, 120, 60 * 1000);
      if (!limit.allowed) return rateLimitResponse(limit, "地点搜索过于频繁，请稍后再试。");
    } catch {
      return Response.json({ error: "地图安全服务暂时不可用，请稍后再试。" }, { status: 503 });
    }
    const url = new URL(request.url), keywords = (url.searchParams.get("keywords") || "").trim().slice(0, 80), cityId = url.searchParams.get("cityId") || "", tripSlug = url.searchParams.get("tripSlug") || "", requestedRegion = (url.searchParams.get("region") || "").trim().slice(0, 40), rectangle = (url.searchParams.get("rectangle") || "").trim().slice(0, 120);
    if (!keywords) return Response.json({ error: "请输入地点。" }, { status: 400 });
    const db = getDb();
    if (tripSlug) {
      const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, tripSlug)).limit(1))[0];
      if (!trip || !actor || !(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
      if (cityId && !(await db.select({ cityId: tripCityRecords.cityId }).from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, cityId))).limit(1))[0]) return Response.json({ error: "城市不属于当前行程。" }, { status: 400 });
    } else if (cityId) {
      const visibleCity = (await db.select({ cityId: tripCityRecords.cityId }).from(tripCityRecords)
        .innerJoin(tripMemberRecords, eq(tripMemberRecords.tripId, tripCityRecords.tripId))
        .where(and(eq(tripCityRecords.cityId, cityId), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0];
      if (!visibleCity) return Response.json({ error: "城市不属于你的行程。" }, { status: 403 });
    } else {
      return Response.json({ error: "地点搜索必须绑定到你的行程或城市。" }, { status: 400 });
    }
    const city = cityId ? (await db.select().from(cityRecords).where(eq(cityRecords.id, cityId)).limit(1))[0] : null;
    if (cityId && !city) return Response.json({ error: "城市不存在。" }, { status: 404 });
    return Response.json({ pois: await searchAmapPois(keywords, requestedRegion || city?.name || "全国", rectangle || undefined) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const classified = classifyAmapError(error, "poi");
    console.error("amap place search failed", { requestType: "poi-search", code, keywordLength: new URL(request.url).searchParams.get("keywords")?.trim().length || 0, classifiedCode: classified.code });
    return Response.json({ error: classified.message, code: classified.code }, { status: classified.status });
  }
}
