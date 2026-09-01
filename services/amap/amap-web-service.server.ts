import { getRuntimeEnv } from "@/db";
import type { AMapPoiCandidate, AMapRouteMode, AMapRouteResult, AMapRouteStep } from "@/services/amap/amap-types";

const base = "https://restapi.amap.com";
const routeCache = new Map<string, { expiresAt: number; result: AMapRouteResult }>();

function requiredKey() {
  const key = getRuntimeEnv().AMAP_WEB_SERVICE_KEY;
  if (!key) throw new Error("AMAP_NOT_CONFIGURED");
  return key;
}

async function amapFetch(path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, base);
  url.searchParams.set("key", requiredKey());
  url.searchParams.set("output", "json");
  for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("AMAP_UPSTREAM_FAILED");
  const data = await response.json() as Record<string, unknown>;
  if (String(data.status) !== "1") throw new Error(`AMAP_${String(data.infocode || "FAILED")}`);
  return data;
}

function scalar(value: unknown) {
  if (Array.isArray(value)) return value[0] == null ? "" : String(value[0]);
  return value == null ? "" : String(value);
}

function parseLocation(value: unknown): [number, number] | null {
  const [lng, lat] = scalar(value).split(",").map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function mapPoi(value: unknown): AMapPoiCandidate | null {
  if (!value || typeof value !== "object") return null;
  const poi = value as Record<string, unknown>, location = parseLocation(poi.location);
  if (!location || !scalar(poi.id) || !scalar(poi.name)) return null;
  return {
    id: scalar(poi.id), name: scalar(poi.name), address: scalar(poi.address) || null,
    longitude: location[0], latitude: location[1], adcode: scalar(poi.adcode) || null,
    cityCode: scalar(poi.citycode) || null, district: scalar(poi.adname) || null,
    typeCode: scalar(poi.typecode) || null,
  };
}

export async function searchAmapPois(keywords: string, region: string, rectangle?: string) {
  const data = await amapFetch("/v5/place/text", { keywords, region, rectangle, city_limit: "true", page_size: "12", show_fields: "business" });
  return (Array.isArray(data.pois) ? data.pois : []).map(mapPoi).filter((item): item is AMapPoiCandidate => Boolean(item));
}

export async function getAmapPoi(id: string) {
  const data = await amapFetch("/v5/place/detail", { id, show_fields: "business" });
  const poi = (Array.isArray(data.pois) ? data.pois : []).map(mapPoi).find(Boolean);
  if (!poi) throw new Error("AMAP_POI_NOT_FOUND");
  return poi;
}

export async function geocodeAmapAddress(address: string, city: string) {
  const data = await amapFetch("/v3/geocode/geo", { address, city });
  const first = Array.isArray(data.geocodes) && data.geocodes[0] && typeof data.geocodes[0] === "object" ? data.geocodes[0] as Record<string, unknown> : null;
  const location = first ? parseLocation(first.location) : null;
  if (!first || !location) throw new Error("AMAP_GEOCODE_NOT_FOUND");
  return { formattedAddress: scalar(first.formatted_address) || address, longitude: location[0], latitude: location[1], adcode: scalar(first.adcode) || null, cityCode: scalar(first.citycode) || null, district: scalar(first.district) || null, coordinateSystem: "GCJ02" as const };
}

function collectPolylineStrings(value: unknown, output: string[] = []) {
  if (typeof value === "string" && /^\d{2,3}\.\d+,[+-]?\d{1,2}\.\d+/.test(value)) output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectPolylineStrings(item, output));
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value as Record<string, unknown>)) if (key === "polyline" || typeof item === "object") collectPolylineStrings(item, output);
  return output;
}

function polylinesFrom(value: unknown) {
  return collectPolylineStrings(value).map((line) => line.split(";").map(parseLocation).filter((point): point is [number, number] => Boolean(point))).filter((line) => line.length > 1);
}

function numberOrNull(value: unknown) {
  const parsed = Number(scalar(value)); return Number.isFinite(parsed) ? parsed : null;
}

function normalizedStep(modeValue: unknown): AMapRouteStep["mode"] {
  const mode = scalar(modeValue).toLowerCase();
  return mode.includes("walk") ? "walking" : mode.includes("subway") || mode.includes("metro") || mode.includes("rail") ? "subway" : mode.includes("bus") ? "bus" : mode.includes("taxi") || mode.includes("drive") ? "taxi" : "other";
}

function mapRouteStep(value: Record<string, unknown>, modeValue?: unknown): AMapRouteStep {
  const mode = normalizedStep(modeValue ?? value.mode ?? value.type ?? "");
  return { mode, instruction: scalar(value.instruction) || scalar(value.step) || null, lineName: scalar(value.route_name || value.line_name || value.name) || null, direction: scalar(value.direction || value.exit || value.trip) || null, stationCount: numberOrNull(value.station_count || value.via_num), durationSeconds: numberOrNull(value.duration), distanceMeters: numberOrNull(value.distance), polyline: polylinesFrom(value)[0] || [] };
}

function transitSteps(value: Record<string, unknown>): AMapRouteStep[] {
  const steps: AMapRouteStep[] = [];
  const walking = value.walking && typeof value.walking === "object" ? value.walking as Record<string, unknown> : null;
  if (walking) {
    const walkSteps = Array.isArray(walking.steps) ? walking.steps : [walking];
    for (const step of walkSteps) if (step && typeof step === "object") steps.push(mapRouteStep(step as Record<string, unknown>, "walking"));
  }
  const bus = value.bus && typeof value.bus === "object" ? value.bus as Record<string, unknown> : null;
  if (bus) {
    const lines = Array.isArray(bus.buslines) ? bus.buslines : [bus];
    for (const line of lines) if (line && typeof line === "object") steps.push(mapRouteStep(line as Record<string, unknown>, "bus"));
  }
  const railway = value.railway && typeof value.railway === "object" ? value.railway as Record<string, unknown> : null;
  if (railway) {
    const lines = Array.isArray(railway.spaces) ? railway.spaces : [railway];
    for (const line of lines) if (line && typeof line === "object") steps.push(mapRouteStep(line as Record<string, unknown>, "subway"));
  }
  const taxi = value.taxi && typeof value.taxi === "object" ? value.taxi as Record<string, unknown> : null;
  if (taxi) steps.push(mapRouteStep(taxi, "taxi"));
  return steps;
}

export async function planAmapRoute(input: { mode: AMapRouteMode; origin: { longitude: number; latitude: number; providerPlaceId: string | null; cityCode: string | null }; destination: { longitude: number; latitude: number; providerPlaceId: string | null; cityCode: string | null } }): Promise<AMapRouteResult> {
  const cacheKey = [input.mode, input.origin.providerPlaceId || `${input.origin.longitude},${input.origin.latitude}`, input.destination.providerPlaceId || `${input.destination.longitude},${input.destination.latitude}`].join("|");
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const common = { origin: `${input.origin.longitude},${input.origin.latitude}`, destination: `${input.destination.longitude},${input.destination.latitude}`, origin_id: input.origin.providerPlaceId || undefined, destination_id: input.destination.providerPlaceId || undefined };
  const transit = input.mode === "transit" || input.mode === "subway" || input.mode === "bus" || input.mode === "mixed_transit";
  const endpoint = transit ? "/v3/direction/transit/integrated" : input.mode === "taxi" ? "/v3/direction/driving" : `/v5/direction/${input.mode}`;
  const data = await amapFetch(endpoint, transit ? { ...common, city: input.origin.cityCode || undefined, cityd: input.destination.cityCode || undefined, strategy: "0" } : common);
  const route = (data.route && typeof data.route === "object" ? data.route : {}) as Record<string, unknown>;
  const paths = Array.isArray(route.paths) ? route.paths : Array.isArray(route.transits) ? route.transits : [];
  const first = paths[0] && typeof paths[0] === "object" ? paths[0] as Record<string, unknown> : {};
  const rawSteps = Array.isArray(first.steps) ? first.steps : Array.isArray(first.segments) ? first.segments : [];
  const steps: AMapRouteStep[] = rawSteps.flatMap((step) => {
    if (!step || typeof step !== "object") return [];
    const value = step as Record<string, unknown>;
    const structured = transitSteps(value);
    if (structured.length) return structured;
    const transitInfo = value.transit && typeof value.transit === "object" ? value.transit as Record<string, unknown> : value;
    return [mapRouteStep({ ...value, route_name: transitInfo.route_name || transitInfo.line_name || transitInfo.name, direction: transitInfo.direction || transitInfo.exit, station_count: transitInfo.station_count || transitInfo.via_num }, value.mode || value.type)];
  });
  const result = { mode: input.mode, distanceMeters: numberOrNull(first.distance ?? route.distance), durationSeconds: numberOrNull(first.cost && typeof first.cost === "object" ? (first.cost as Record<string, unknown>).duration : first.duration), taxiCost: numberOrNull(route.taxi_cost), transitCost: numberOrNull(first.cost && typeof first.cost === "object" ? (first.cost as Record<string, unknown>).transit_fee : null), polylines: polylinesFrom(first), steps, summary: scalar(first.instruction || first.description) || null };
  routeCache.set(cacheKey, { expiresAt: Date.now() + 120_000, result });
  return result;
}
