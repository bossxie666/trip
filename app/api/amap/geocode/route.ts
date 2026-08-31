import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { geocodeAmapAddress } from "@/services/amap/amap-web-service.server";

export async function POST(request: Request) {
  try {
    if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
    const body = await request.json() as { address?: string; cityId?: string }, address = body.address?.trim().slice(0, 160), cityId = body.cityId?.trim();
    if (!address || !cityId) return Response.json({ error: "请输入地址并选择城市。" }, { status: 400 });
    const city = (await getDb().select().from(cityRecords).where(eq(cityRecords.id, cityId)).limit(1))[0];
    if (!city) return Response.json({ error: "城市不存在。" }, { status: 404 });
    return Response.json({ result: await geocodeAmapAddress(address, city.name) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "AMAP_GEOCODE_NOT_FOUND" ? "没有找到这个地址，请补充区县或门牌号。" : code === "AMAP_NOT_CONFIGURED" ? "地图服务尚未配置。" : "地址解析暂时不可用，请稍后重试。" }, { status: code === "AMAP_GEOCODE_NOT_FOUND" ? 404 : code === "AMAP_NOT_CONFIGURED" ? 503 : 502 });
  }
}
