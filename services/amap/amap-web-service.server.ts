import { getRuntimeEnv } from "@/db";
import type { AMapPoiCandidate, AMapRouteMode, AMapRouteResult, AMapRouteStep } from "@/services/amap/amap-types";

const base = "https://restapi.amap.com";
const routeCache = new Map<string, { expiresAt: number; result: AMapRouteResult }>();

export class AMapUpstreamError extends Error {
  readonly kind: "http" | "api";
  readonly endpoint: string;
  readonly infocode: string | null;

  constructor(kind: "http" | "api", endpoint: string, infocode: string | null = null) {
    super(kind === "http" ? "AMAP_UPSTREAM_HTTP" : "AMAP_UPSTREAM_API");
    this.name = "AMapUpstreamError";
    this.kind = kind;
    this.endpoint = endpoint;
    this.infocode = infocode;
  }
}

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
  if (!response.ok) throw new AMapUpstreamError("http", path);
  const data = await response.json() as Record<string, unknown>;
  if (String(data.status) !== "1") throw new AMapUpstreamError("api", path, scalar(data.infocode) || null);
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
  try {
    const data = await amapFetch("/v5/place/text", { keywords, region, rectangle, city_limit: "true", page_size: "12", show_fields: "business" });
    return (Array.isArray(data.pois) ? data.pois : []).map(mapPoi).filter((item): item is AMapPoiCandidate => Boolean(item));
  } catch (error) {
    const upstream = error instanceof AMapUpstreamError ? error : null;
    console.error("amap poi search upstream failure", { endpoint: upstream?.endpoint || "/v5/place/text", kind: upstream?.kind || "unknown", infocode: upstream?.infocode || null, region, keywordLength: keywords.length });
    try {
      // v3 remains a compatibility fallback for regions/keywords rejected by
      // the v5 endpoint. It uses the same server-side key and never returns it
      // to the browser.
      const fallback = await amapFetch("/v3/place/text", { keywords, city: region, citylimit: "true", offset: "12", page: "1", extensions: "all", rectangle });
      return (Array.isArray(fallback.pois) ? fallback.pois : []).map(mapPoi).filter((item): item is AMapPoiCandidate => Boolean(item));
    } catch (fallbackError) {
      const fallback = fallbackError instanceof AMapUpstreamError ? fallbackError : null;
      console.error("amap poi search fallback failure", { endpoint: fallback?.endpoint || "/v3/place/text", kind: fallback?.kind || "unknown", infocode: fallback?.infocode || null, region, keywordLength: keywords.length });
      throw fallbackError;
    }
  }
}

export async function getAmapPoi(id: string) {
  try {
    const data = await amapFetch("/v5/place/detail", { id, show_fields: "business" });
    const poi = (Array.isArray(data.pois) ? data.pois : []).map(mapPoi).find(Boolean);
    if (!poi) throw new Error("AMAP_POI_NOT_FOUND");
    return poi;
  } catch (error) {
    const upstream = error instanceof AMapUpstreamError ? error : null;
    console.error("amap poi detail upstream failure", { endpoint: upstream?.endpoint || "/v5/place/detail", kind: upstream?.kind || "unknown", infocode: upstream?.infocode || null });
    const fallback = await amapFetch("/v3/place/detail", { id, extensions: "all" });
    const poi = (Array.isArray(fallback.pois) ? fallback.pois : []).map(mapPoi).find(Boolean);
    if (!poi) throw new Error("AMAP_POI_NOT_FOUND");
    return poi;
  }
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

function positiveNumber(...values: unknown[]) {
  for (const value of values) {
    const number = numberOrNull(value);
    if (number != null && number > 0) return Math.round(number);
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
    stationCount: positiveNumber(value.station_count, value.stationCount, value.via_num, value.viaNum, viaStops.length),
    fromStation: stationText(departure),
    toStation: stationText(arrival),
    transfer: firstText(value.transfer, value.transfer_info, value.transferInfo),
    durationSeconds: numberOrNull(value.duration),
    distanceMeters: numberOrNull(value.distance),
    polyline: polylinesFrom(value)[0] || [],
  };
}

function dedupeTransitSteps(steps: AMapRouteStep[]) {
  const result: AMapRouteStep[] = [];
  for (const step of steps) {
    if ((step.mode === "subway" || step.mode === "bus") && !step.lineName && !step.fromStation && !step.toStation) continue;
    if (step.stationCount === 0) continue;
    const previous = result.at(-1);
    if (previous?.mode === "walking" && step.mode === "walking" && previous.fromStation === step.fromStation && previous.toStation === step.toStation && previous.instruction === step.instruction) continue;
    result.push(step);
  }
  return result;
}

/** Convert the ordered segments returned by AMap integrated transit into
 * readable walking/subway/bus/transfer legs. Exported for parser tests. */
export function normalizeTransitSteps(value: Record<string, unknown>): AMapRouteStep[] {
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
    const lines = Array.isArray(railway.spaces) ? railway.spaces : Array.isArray(railway.lines) ? railway.lines : [railway];
    for (const line of lines) if (line && typeof line === "object") steps.push(mapRouteStep(line as Record<string, unknown>, "subway"));
  }
  const transfer = value.transfer || value.transfers;
  if (Array.isArray(transfer)) for (const entry of transfer) if (entry && typeof entry === "object") steps.push({ ...mapRouteStep(entry as Record<string, unknown>, "other"), transfer: firstText((entry as Record<string, unknown>).name, (entry as Record<string, unknown>).instruction, (entry as Record<string, unknown>).description) });
  else if (transfer) steps.push({ mode: "other", instruction: firstText(transfer), lineName: null, direction: null, stationCount: null, fromStation: null, toStation: null, transfer: firstText(transfer), durationSeconds: null, distanceMeters: null, polyline: [] });
  const taxi = value.taxi && typeof value.taxi === "object" ? value.taxi as Record<string, unknown> : null;
  if (taxi) steps.push(mapRouteStep(taxi, "taxi"));
  return dedupeTransitSteps(steps);
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
    const structured = normalizeTransitSteps(value);
    if (structured.length) return structured;
    const transitInfo = value.transit && typeof value.transit === "object" ? value.transit as Record<string, unknown> : value;
    return [mapRouteStep({ ...value, route_name: transitInfo.route_name || transitInfo.line_name || transitInfo.name, direction: transitInfo.direction || transitInfo.exit, station_count: transitInfo.station_count || transitInfo.via_num }, value.mode || value.type)];
  });
  const result = { mode: input.mode, distanceMeters: numberOrNull(first.distance ?? route.distance), durationSeconds: numberOrNull(first.cost && typeof first.cost === "object" ? (first.cost as Record<string, unknown>).duration : first.duration), taxiCost: numberOrNull(route.taxi_cost), transitCost: numberOrNull(first.cost && typeof first.cost === "object" ? (first.cost as Record<string, unknown>).transit_fee : null), polylines: polylinesFrom(first), steps, summary: scalar(first.instruction || first.description) || null };
  routeCache.set(cacheKey, { expiresAt: Date.now() + 120_000, result });
  return result;
}
