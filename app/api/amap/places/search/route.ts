import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { searchAmapPois } from "@/services/amap/amap-web-service.server";

export async function GET(request: Request) {
  try {
    if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const url = new URL(request.url), keywords = (url.searchParams.get("keywords") || "").trim().slice(0, 80), cityId = url.searchParams.get("cityId") || "";
    if (!keywords || !cityId) return Response.json({ error: "请输入地点并选择城市。" }, { status: 400 });
    const city = (await getDb().select().from(cityRecords).where(eq(cityRecords.id, cityId)).limit(1))[0];
    if (!city) return Response.json({ error: "城市不存在。" }, { status: 404 });
    return Response.json({ pois: await searchAmapPois(keywords, city.name) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "AMAP_NOT_CONFIGURED" ? "地图服务尚未配置。" : "高德地点搜索暂时不可用，请稍后重试。" }, { status: code === "AMAP_NOT_CONFIGURED" ? 503 : 502 });
  }
}
