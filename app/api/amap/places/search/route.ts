import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, tripCityRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { classifyAmapError, searchAmapPois } from "@/services/amap/amap-web-service.server";

export async function GET(request: Request) {
  try {
    if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const url = new URL(request.url), keywords = (url.searchParams.get("keywords") || "").trim().slice(0, 80), cityId = url.searchParams.get("cityId") || "", tripSlug = url.searchParams.get("tripSlug") || "", requestedRegion = (url.searchParams.get("region") || "").trim().slice(0, 40), rectangle = (url.searchParams.get("rectangle") || "").trim().slice(0, 120);
    if (!keywords || !cityId) return Response.json({ error: "请输入地点并选择城市。" }, { status: 400 });
    const db = getDb();
    if (tripSlug) {
      const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, tripSlug)).limit(1))[0];
      const actor = await getCurrentMember();
      if (!trip || !actor || !(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
      if (!(await db.select({ cityId: tripCityRecords.cityId }).from(tripCityRecords).where(and(eq(tripCityRecords.tripId, trip.id), eq(tripCityRecords.cityId, cityId))).limit(1))[0]) return Response.json({ error: "城市不属于当前行程。" }, { status: 400 });
    }
    const city = (await db.select().from(cityRecords).where(eq(cityRecords.id, cityId)).limit(1))[0];
    if (!city) return Response.json({ error: "城市不存在。" }, { status: 404 });
    return Response.json({ pois: await searchAmapPois(keywords, requestedRegion || city.name, rectangle || undefined) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const classified = classifyAmapError(error, "poi");
    console.error("amap place search failed", { requestType: "poi-search", code, keywordLength: new URL(request.url).searchParams.get("keywords")?.trim().length || 0, classifiedCode: classified.code });
    return Response.json({ error: classified.message, code: classified.code }, { status: classified.status });
  }
}
