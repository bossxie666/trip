import { getRuntimeEnv } from "../../db/index.ts";
import type { AMapPoiCandidate, AMapRouteMode, AMapRouteResult, AMapRouteStep } from "./amap-types.ts";
import { aggregateTransitSteps } from "./transit-steps.ts";

const base = "https://restapi.amap.com";
const routeCache = new Map<string, { expiresAt: number; result: AMapRouteResult }>();
const poiCache = new Map<string, { expiresAt: number; pois: AMapPoiCandidate[] }>();
const requestCache = new Map<string, Promise<Record<string, unknown>>>();
const AMAP_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 1;

export class AMapUpstreamError extends Error {
  readonly kind: "http" | "api" | "timeout";
  readonly endpoint: string;
  readonly infocode: string | null;
  readonly httpStatus: number | null;
  readonly upstreamMessage: string | null;
  readonly retryable: boolean;

  constructor(kind: "http" | "api" | "timeout", endpoint: string, infocode: string | null = null, options: { httpStatus?: number | null; message?: string | null; retryable?: boolean } = {}) {
    super(kind === "timeout" ? "AMAP_UPSTREAM_TIMEOUT" : kind === "http" ? "AMAP_UPSTREAM_HTTP" : "AMAP_UPSTREAM_API");
    this.name = "AMapUpstreamError";
    this.kind = kind;
    this.endpoint = endpoint;
    this.infocode = infocode;
    this.httpStatus = options.httpStatus ?? null;
    this.upstreamMessage = options.message ?? null;
    this.retryable = options.retryable ?? (kind === "timeout" || kind === "http");
  }
}

function requiredKey() {
  const key = getRuntimeEnv().AMAP_WEB_SERVICE_KEY;
  if (!key) throw new Error("AMAP_NOT_CONFIGURED");
  return key;
}

function retryableInfocode(code: string | null) {
  if (!code) return true;
  return !new Set(["10001", "10002", "10003", "10004", "10005", "10008", "10009", "10010", "10011", "10012", "10013", "10014"]).has(code);
}

function requestKey(path: string, params: Record<string, string | undefined>) {
  return `${path}?${Object.entries(params).filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&")}`;
}

async function amapFetch(path: string, params: Record<string, string | undefined>, requestType = "amap") {
  const key = requestKey(path, params);
  const active = requestCache.get(key);
  if (active) return active;
  const pending = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const startedAt = Date.now();
      try {
        const url = new URL(path, base);
        url.searchParams.set("key", requiredKey());
        url.searchParams.set("output", "json");
        for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, value);
        const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(AMAP_TIMEOUT_MS) });
        if (!response.ok) throw new AMapUpstreamError("http", path, null, { httpStatus: response.status, retryable: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500 });
        const data = await response.json() as Record<string, unknown>;
        if (String(data.status) !== "1") throw new AMapUpstreamError("api", path, scalar(data.infocode) || null, { message: scalar(data.info) || null, retryable: retryableInfocode(scalar(data.infocode) || null) });
        console.info("amap upstream request", { requestType, endpoint: path, httpStatus: response.status, infocode: scalar(data.infocode) || null, message: scalar(data.info) || null, latencyMs: Date.now() - startedAt, retry: attempt > 0 });
        return data;
      } catch (error) {
        if (error instanceof Error && error.message === "AMAP_NOT_CONFIGURED") throw error;
        const upstream = error instanceof AMapUpstreamError ? error : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? new AMapUpstreamError("timeout", path) : new AMapUpstreamError("http", path, null, { message: error instanceof Error ? error.message : null, retryable: true });
        lastError = upstream;
        console.error("amap upstream request", { requestType, endpoint: path, httpStatus: upstream.httpStatus, infocode: upstream.infocode, message: upstream.upstreamMessage, latencyMs: Date.now() - startedAt, retry: attempt > 0 });
        if (!upstream.retryable || attempt >= MAX_RETRIES) throw upstream;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AMAP_UPSTREAM_FAILED");
  })();
  requestCache.set(key, pending);
  try { return await pending; } finally { requestCache.delete(key); }
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
    cityName: scalar(poi.cityname) || scalar(poi.city) || null,
    provinceName: scalar(poi.pname) || scalar(poi.province) || null,
    typeCode: scalar(poi.typecode) || null,
  };
}

export async function searchAmapPois(keywords: string, region = "全国", rectangle?: string) {
  const cacheKey = `${keywords.trim().toLowerCase()}|${region.trim()}|${rectangle || ""}`;
  const cached = poiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.pois;
  const limited = Boolean(region && region !== "全国");
  try {
    const data = await amapFetch("/v5/place/text", { keywords, region: limited ? region : undefined, rectangle, city_limit: limited ? "true" : "false", page_size: "12", show_fields: "business" }, "poi-search");
    const pois = (Array.isArray(data.pois) ? data.pois : []).map(mapPoi).filter((item): item is AMapPoiCandidate => Boolean(item));
    poiCache.set(cacheKey, { expiresAt: Date.now() + 60_000, pois });
    return pois;
  } catch (error) {
    const upstream = error instanceof AMapUpstreamError ? error : null;
    if (upstream && !upstream.retryable) throw upstream;
    // v3 remains a compatibility fallback for regions/keywords rejected by
    // the v5 endpoint. It uses the same server-side key and never returns it
    // to the browser.
    const fallback = await amapFetch("/v3/place/text", { keywords, city: limited ? region : "全国", citylimit: limited ? "true" : "false", offset: "12", page: "1", extensions: "all", rectangle }, "poi-search-fallback");
    const pois = (Array.isArray(fallback.pois) ? fallback.pois : []).map(mapPoi).filter((item): item is AMapPoiCandidate => Boolean(item));
    poiCache.set(cacheKey, { expiresAt: Date.now() + 60_000, pois });
    return pois;
  }
}

export async function getAmapPoi(id: string) {
  try {
    const data = await amapFetch("/v5/place/detail", { id, show_fields: "business" }, "poi-detail");
    const poi = (Array.isArray(data.pois) ? data.pois : []).map(mapPoi).find(Boolean);
    if (!poi) throw new Error("AMAP_POI_NOT_FOUND");
    return poi;
  } catch (error) {
    const upstream = error instanceof AMapUpstreamError ? error : null;
    if (upstream && !upstream.retryable) throw upstream;
    const fallback = await amapFetch("/v3/place/detail", { id, extensions: "all" }, "poi-detail-fallback");
    const poi = (Array.isArray(fallback.pois) ? fallback.pois : []).map(mapPoi).find(Boolean);
    if (!poi) throw new Error("AMAP_POI_NOT_FOUND");
    return poi;
  }
}

export async function geocodeAmapAddress(address: string, city: string) {
  const data = await amapFetch("/v3/geocode/geo", { address, city }, "geocode");
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
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(scalar(value)); return Number.isFinite(parsed) ? parsed : null;
}

function normalizedStep(modeValue: unknown): AMapRouteStep["mode"] {
  const mode = scalar(modeValue).toLowerCase();
  return mode.includes("walk") ? "walking" : mode.includes("subway") || mode.includes("metro") || mode.includes("rail") ? "subway" : mode.includes("bus") ? "bus" : mode.includes("taxi") || mode.includes("drive") ? "taxi" : "other";
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = scalar(value).trim();
    if (text) return text;
  }
  return null;
}

function stationText(value: unknown) {
  const object = objectValue(value);
  return object ? firstText(object.name, object.station_name, object.stationName, object.stopname, object.stop_name) : firstText(value);
}

function stationCountNumber(...values: unknown[]) {
  for (const value of values) {
    const number = numberOrNull(value);
    if (number != null) return Math.max(0, Math.round(number));
  }
  return null;
}

function mapRouteStep(value: Record<string, unknown>, modeValue?: unknown): AMapRouteStep {
  const mode = normalizedStep(modeValue ?? value.mode ?? value.type ?? "");
  const departure = value.departure_stop ?? value.departureStop ?? value.from_station ?? value.fromStation ?? value.from;
  const arrival = value.arrival_stop ?? value.arrivalStop ?? value.to_station ?? value.toStation ?? value.to;
  const viaStops = Array.isArray(value.via_stops) ? value.via_stops : Array.isArray(value.viaStops) ? value.viaStops : [];
  return {
    mode,
    instruction: firstText(value.instruction, value.step, value.description),
    lineName: firstText(value.route_name, value.routeName, value.line_name, value.lineName, value.name),
    direction: firstText(value.direction, value.exit, value.trip, value.destination),
    stationCount: stationCountNumber(value.station_count, value.stationCount, value.via_num, value.viaNum, viaStops.length > 0 ? viaStops.length : null),
    fromStation: stationText(departure),
    toStation: stationText(arrival),
    transfer: firstText(value.transfer, value.transfer_info, value.transferInfo),
    durationSeconds: numberOrNull(value.duration),
    distanceMeters: numberOrNull(value.distance),
    polyline: polylinesFrom(value)[0] || [],
  };
}

/** Convert the ordered segments returned by AMap integrated transit into
 * readable walking/subway/bus/transfer legs. Exported for parser tests. */
export function normalizeTransitSteps(value: Record<string, unknown>): AMapRouteStep[] {
  const steps: AMapRouteStep[] = [];
  const append = (kind: string, raw: unknown) => {
    if (Array.isArray(raw)) { raw.forEach((entry) => append(kind, entry)); return; }
    if (!raw || typeof raw !== "object") return;
    const object = raw as Record<string, unknown>;
    if (Array.isArray(object.steps)) { object.steps.forEach((entry) => append(kind, entry)); return; }
    if (kind === "bus" && Array.isArray(object.buslines)) { object.buslines.forEach((entry) => append(kind, entry)); return; }
    if (kind === "railway" && (Array.isArray(object.spaces) || Array.isArray(object.lines))) { const lines = Array.isArray(object.spaces) ? object.spaces : object.lines as unknown[]; lines.forEach((entry) => append(kind, entry)); return; }
    steps.push(mapRouteStep(object, kind === "walking" ? "walking" : kind === "bus" ? "bus" : kind === "railway" ? "subway" : kind));
  };
  // Object insertion order in the integrated-transit payload is the only
  // reliable ordering signal.  Do not emit all walking segments before all
  // rail/bus segments, otherwise the rendered route reverses transfers.
  const segmentKeys = new Set(["walking", "bus", "railway", "subway", "transfer", "transfers", "taxi"]);
  for (const [key, raw] of Object.entries(value)) {
    if (!segmentKeys.has(key)) continue;
    if (key === "transfer" || key === "transfers") {
      if (Array.isArray(raw)) raw.forEach((entry) => { if (entry && typeof entry === "object") steps.push({ ...mapRouteStep(entry as Record<string, unknown>, "other"), transfer: firstText((entry as Record<string, unknown>).name, (entry as Record<string, unknown>).instruction, (entry as Record<string, unknown>).description) }); });
      else if (raw) steps.push({ mode: "other", instruction: firstText(raw), lineName: null, direction: null, stationCount: null, fromStation: null, toStation: null, transfer: firstText(raw), durationSeconds: null, distanceMeters: null, polyline: [] });
    } else append(key, raw);
  }
  if (!steps.length && (value.mode || value.type)) steps.push(mapRouteStep(value, value.mode || value.type));
  return aggregateTransitSteps(steps);
}

export async function planAmapRoute(input: { mode: AMapRouteMode; origin: { longitude: number; latitude: number; providerPlaceId: string | null; cityCode: string | null }; destination: { longitude: number; latitude: number; providerPlaceId: string | null; cityCode: string | null } }): Promise<AMapRouteResult> {
  const cacheKey = [input.mode, input.origin.providerPlaceId || `${input.origin.longitude},${input.origin.latitude}`, input.destination.providerPlaceId || `${input.destination.longitude},${input.destination.latitude}`].join("|");
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const common = { origin: `${input.origin.longitude},${input.origin.latitude}`, destination: `${input.destination.longitude},${input.destination.latitude}`, origin_id: input.origin.providerPlaceId || undefined, destination_id: input.destination.providerPlaceId || undefined };
  const transit = input.mode === "transit" || input.mode === "subway" || input.mode === "bus" || input.mode === "mixed_transit";
  // AMap calls its cycling endpoint "riding".  Keep the public route mode
  // as "bicycling" while translating only at the upstream boundary.
  const endpoint = transit ? "/v3/direction/transit/integrated" : input.mode === "taxi" ? "/v3/direction/driving" : input.mode === "bicycling" ? "/v5/direction/riding" : `/v5/direction/${input.mode}`;
  const data = await amapFetch(endpoint, transit ? { ...common, city: input.origin.cityCode || undefined, cityd: input.destination.cityCode || undefined, strategy: "0" } : common, "route-search");
  const route = (data.route && typeof data.route === "object" ? data.route : {}) as Record<string, unknown>;
  const paths = Array.isArray(route.paths) ? route.paths : Array.isArray(route.transits) ? route.transits : [];
  const first = paths[0] && typeof paths[0] === "object" ? paths[0] as Record<string, unknown> : {};
  const rawSteps = Array.isArray(first.steps) ? first.steps : Array.isArray(first.segments) ? first.segments : [];
  const steps: AMapRouteStep[] = aggregateTransitSteps(rawSteps.flatMap((step) => {
    if (!step || typeof step !== "object") return [];
    const value = step as Record<string, unknown>;
    const structured = normalizeTransitSteps(value);
    if (structured.length) return structured;
    const transitInfo = value.transit && typeof value.transit === "object" ? value.transit as Record<string, unknown> : value;
    return [mapRouteStep({ ...value, route_name: transitInfo.route_name || transitInfo.line_name || transitInfo.name, direction: transitInfo.direction || transitInfo.exit, station_count: transitInfo.station_count ?? transitInfo.via_num }, value.mode || value.type)];
  }));
  const result = { mode: input.mode, distanceMeters: numberOrNull(first.distance ?? route.distance), durationSeconds: numberOrNull(first.cost && typeof first.cost === "object" ? (first.cost as Record<string, unknown>).duration : first.duration), taxiCost: numberOrNull(route.taxi_cost), transitCost: numberOrNull(first.cost && typeof first.cost === "object" ? (first.cost as Record<string, unknown>).transit_fee : null), polylines: polylinesFrom(first), steps, summary: scalar(first.instruction || first.description) || null };
  routeCache.set(cacheKey, { expiresAt: Date.now() + 120_000, result });
  return result;
}

export function classifyAmapError(error: unknown, fallback: "poi" | "route" | "geocode") {
  if (error instanceof AMapUpstreamError) {
    if (error.httpStatus === 429 || error.infocode === "10003") return { status: 429, code: "AMAP_RATE_LIMIT", message: "请求过于频繁，请稍后再试。" };
    if (error.kind === "timeout") return { status: 504, code: "AMAP_TIMEOUT", message: fallback === "route" ? "路线暂时无法计算，请重试。" : "网络异常，请重试。" };
    if (error.infocode && ["10001", "10004", "10008", "10009", "10010", "10011", "10012", "10013", "10014"].includes(error.infocode)) return { status: 503, code: "AMAP_CONFIGURATION", message: "地图服务配置异常，请联系管理员。" };
    if (error.kind === "http") return { status: 502, code: "AMAP_NETWORK", message: fallback === "route" ? "路线暂时无法计算，请重试。" : "网络异常，请重试。" };
    return { status: 502, code: "AMAP_SERVICE", message: fallback === "route" ? "地图服务繁忙，路线暂时无法计算。" : "地图服务繁忙，请稍后重试。" };
  }
  const code = error instanceof Error ? error.message : "";
  if (code === "AMAP_NOT_CONFIGURED") return { status: 503, code, message: "地图服务配置异常，请联系管理员。" };
  if (code.endsWith("_NOT_FOUND")) return { status: 404, code, message: fallback === "poi" ? "没有找到地点。" : "没有找到可用路线。" };
  return { status: 502, code: "AMAP_UNKNOWN", message: fallback === "route" ? "路线暂时无法计算，请重试。" : "网络异常，请重试。" };
}
