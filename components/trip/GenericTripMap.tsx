"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";
import type { TripPlaceStatus } from "@/models/travel";

type MapPlace = { id: string; cityId: string; name: string; address: string | null; latitude: number | null; longitude: number | null; coordinateSystem?: string | null; planStatus?: TripPlaceStatus };
type MapWorkspace = { days: { id: string; dayNumber: number; title: string; places: { sortOrder: number; planStatus?: TripPlaceStatus; place: MapPlace }[] }[] };
type AMapObject = { add(value: unknown): void; remove(value: unknown): void; setFitView(value?: unknown[]): void; destroy(): void };
type AMapNamespace = {
  Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapObject;
  Marker: new (options: Record<string, unknown>) => unknown;
  Polyline: new (options: Record<string, unknown>) => unknown;
};

declare global { interface Window { AMap?: AMapNamespace; _AMapSecurityConfig?: { serviceHost: string } } }

let loader: Promise<AMapNamespace> | null = null;
async function loadAMap() {
  if (window.AMap) return window.AMap;
  if (!loader) loader = (async () => {
    const response = await fetch("/api/amap/config"), config = await response.json() as { key?: string; version?: string; serviceHost?: string; error?: string };
    if (!response.ok || !config.key || !config.serviceHost) throw new Error(config.error || "地图配置读取失败。");
    const jsKey = config.key;
    window._AMapSecurityConfig = { serviceHost: config.serviceHost };
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-trip-amap]");
      if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("高德地图加载失败。")), { once: true }); return; }
      const script = document.createElement("script"); script.dataset.tripAmap = "true"; script.src = `https://webapi.amap.com/maps?v=${encodeURIComponent(config.version || "2.0")}&key=${encodeURIComponent(jsKey)}`; script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("高德地图加载失败。")); document.head.appendChild(script);
    });
    if (!window.AMap) throw new Error("高德地图加载失败。"); return window.AMap;
  })();
  return loader;
}

const modeLabels: Record<AMapRouteMode, string> = { walking: "步行", subway: "地铁", bus: "公交", mixed_transit: "地铁 + 公交", taxi: "打车", transit: "公共交通", driving: "驾车", bicycling: "骑行" };
function minutes(seconds: number | null) { return seconds == null ? "时间未知" : `${Math.max(1, Math.round(seconds / 60))} 分钟`; }
function distance(meters: number | null) { return meters == null ? "距离未知" : meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`; }

export function GenericTripMap({ slug, initial, cityId, fallbackCenter }: { slug: string; initial: MapWorkspace; cityId?: string; fallbackCenter?: readonly [number, number] }) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<AMapObject | null>(null), overlays = useRef<unknown[]>([]);
  const fallbackLongitude = fallbackCenter?.[0] ?? 121.47, fallbackLatitude = fallbackCenter?.[1] ?? 31.23;
  const initialDay = initial.days.find((item) => !cityId || item.places.some((place) => place.place.cityId === cityId)) || initial.days[0];
  const [workspace, setWorkspace] = useState(initial), [dayId, setDayId] = useState(initialDay?.id || ""), [originId, setOriginId] = useState(""), [destinationId, setDestinationId] = useState(""), [mode, setMode] = useState<AMapRouteMode>("walking"), [route, setRoute] = useState<AMapRouteResult | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [routing, setRouting] = useState(false), [mapReady, setMapReady] = useState(false);
  const day = workspace.days.find((item) => item.id === dayId) || workspace.days.find((item) => !cityId || item.places.some((place) => place.place.cityId === cityId)) || workspace.days[0];
  const dayPlaces = useMemo(() => (day?.places || []).filter((item) => !cityId || item.place.cityId === cityId), [day, cityId]);
  const routePlaces = useMemo(() => dayPlaces.filter((item) => item.planStatus === "selected" || item.planStatus === "locked" || !item.planStatus).map((item) => item.place), [dayPlaces]);
  const selectedOriginId = routePlaces.some((place) => place.id === originId) ? originId : routePlaces[0]?.id || "", selectedDestinationId = routePlaces.some((place) => place.id === destinationId) ? destinationId : routePlaces.find((place) => place.id !== selectedOriginId)?.id || "";
  const allPlaces = useMemo(() => dayPlaces.map((item, index) => ({ ...item.place, planStatus: item.planStatus, markerNumber: index + 1 })).filter((item) => item.latitude != null && item.longitude != null), [dayPlaces]);

  useEffect(() => { const listener = (event: Event) => setWorkspace((event as CustomEvent<MapWorkspace>).detail); window.addEventListener("trip-place-workspace", listener); return () => window.removeEventListener("trip-place-workspace", listener); }, []);
  useEffect(() => { let cancelled = false; if (!container.current) return; loadAMap().then((AMap) => { if (cancelled || !container.current) return; mapRef.current = new AMap.Map(container.current, { zoom: 11, center: [fallbackLongitude, fallbackLatitude], viewMode: "2D" }); setMapReady(true); setLoading(false); }).catch((caught) => { if (!cancelled) { setError(caught instanceof Error ? caught.message : "地图加载失败。"); setLoading(false); } }); return () => { cancelled = true; mapRef.current?.destroy(); mapRef.current = null; }; }, [fallbackLatitude, fallbackLongitude]);
  useEffect(() => { const map = mapRef.current, AMap = window.AMap; if (!mapReady || !map || !AMap) return; if (overlays.current.length) map.remove(overlays.current); const markers = allPlaces.map((place) => new AMap.Marker({ position: [place.longitude!, place.latitude!], title: place.name, opacity: place.planStatus === "candidate" ? 0.48 : 1, label: { content: `${place.markerNumber}. ${place.name}`, direction: "top" } })); const lines = (route?.polylines || []).map((path) => new AMap.Polyline({ path, strokeColor: "#bf6648", strokeWeight: 6, strokeOpacity: 0.9, showDir: true })); overlays.current = [...markers, ...lines]; if (overlays.current.length) { map.add(overlays.current); map.setFitView(overlays.current); } }, [allPlaces, mapReady, route]);

  async function plan() { setRouting(true); setError(""); try { const response = await fetch("/api/amap/routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, originPlaceId: selectedOriginId, destinationPlaceId: selectedDestinationId, mode }) }), payload = await response.json() as { route?: AMapRouteResult; error?: string }; if (!response.ok || !payload.route) throw new Error(payload.error || "路线规划失败。"); setRoute(payload.route); } catch (caught) { setError(caught instanceof Error ? caught.message : "路线规划失败。"); setRoute(null); } finally { setRouting(false); } }

  return <div className="generic-trip-map">
    <div className="map-toolbar"><label>Day<select value={day?.id || ""} onChange={(event) => { setDayId(event.target.value); setOriginId(""); setDestinationId(""); setRoute(null); }}>{workspace.days.map((item) => <option key={item.id} value={item.id}>Day {item.dayNumber}</option>)}</select></label><label>起点<select value={selectedOriginId} onChange={(event) => setOriginId(event.target.value)}><option value="">{routePlaces.length ? "请选择" : "暂无已选地点"}</option>{routePlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>终点<select value={selectedDestinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">{routePlaces.length ? "请选择" : "暂无已选地点"}</option>{routePlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
    <div className="route-modes">{(["walking", "subway", "bus", "mixed_transit", "taxi"] as AMapRouteMode[]).map((item) => <button type="button" className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{modeLabels[item]}</button>)}<button type="button" className="route-submit" disabled={!selectedOriginId || !selectedDestinationId || selectedOriginId === selectedDestinationId || routing} onClick={plan}>{routing ? "规划中…" : "规划路线"}</button></div>
    <div className="amap-canvas-wrap"><div ref={container} className="amap-canvas" aria-label="高德地图" />{loading && <p className="map-state">地图加载中…</p>}{!loading && !allPlaces.length && <p className="map-state">先从高德搜索并添加至少一个地点。</p>}{!loading && allPlaces.length > 0 && routePlaces.length < 2 && <p className="map-state">候选地点仅作参考；至少选择两个已选地点后才能规划路线。</p>}</div>
    {route && <div className="route-summary"><b>{modeLabels[route.mode]}</b><span>{distance(route.distanceMeters)}</span><span>{minutes(route.durationSeconds)}</span>{route.transitCost != null && <span>公共交通约 ¥{route.transitCost}</span>}{route.taxiCost != null && <span>打车参考 ¥{route.taxiCost}</span>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
