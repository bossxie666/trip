import { getCurrentMember } from "@/services/auth.server";
import { getRuntimeEnv } from "@/db";

export async function GET(request: Request) {
  if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const key = getRuntimeEnv().AMAP_JS_API_KEY;
  if (!key) return Response.json({ error: "地图服务尚未配置。" }, { status: 503 });
  return Response.json({ key, version: "2.0", serviceHost: `${new URL(request.url).origin}/_AMapService` });
}
