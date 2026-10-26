import { and, eq } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { placeRecords } from "@/db/schema";
import { getAmapPoi } from "@/services/amap/amap-web-service.server";

/** Knowledge places use verified public POIs, without creating a dummy trip. */
export async function resolveKnowledgePoi(providerPlaceId: string, memberId: string) {
  const db = getDb();
  const existing = (await db.select().from(placeRecords).where(and(eq(placeRecords.provider, "amap"), eq(placeRecords.providerPlaceId, providerPlaceId))).limit(1))[0];
  if (existing) return existing;
  const poi = await getAmapPoi(providerPlaceId);
  const cityName = (poi.cityName || poi.provinceName || "").replace(/市$/, "").trim();
  if (!cityName || !Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)) throw new Error("INVALID_KNOWLEDGE_PLACE");
  const now = new Date().toISOString(), cityId = crypto.randomUUID(), placeId = crypto.randomUUID(), d1 = getRuntimeEnv().DB;
  await d1.batch([
    d1.prepare("INSERT INTO cities (id,slug,name,created_at) VALUES (?,?,?,?) ON CONFLICT(name) DO NOTHING").bind(cityId, `city-${cityId}`, cityName, now),
    d1.prepare("INSERT INTO places (id,name,city_id,address,latitude,longitude,coordinate_system,provider,provider_place_id,adcode,city_code,district,type_code,provider_updated_at,created_by_member_id,updated_by_member_id,created_at,updated_at) SELECT ?,?,id,?,?,?,'GCJ02','amap',?,?,?,?,?,?,?,?,?,? FROM cities WHERE name=? ON CONFLICT(provider,provider_place_id) DO NOTHING").bind(placeId, poi.name, poi.address, poi.latitude, poi.longitude, poi.id, poi.adcode, poi.cityCode, poi.district, poi.typeCode, now, memberId, memberId, now, now, cityName),
  ]);
  return (await db.select().from(placeRecords).where(and(eq(placeRecords.provider, "amap"), eq(placeRecords.providerPlaceId, poi.id))).limit(1))[0];
}
