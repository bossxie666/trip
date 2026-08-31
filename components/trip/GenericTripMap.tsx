"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";

type MapPlace = { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; coordinateSystem?: string | null };
type MapWorkspace = { days: { id: string; dayNumber: number; title: string; places: { sortOrder: number; place: MapPlace }[] }[] };
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
    window._AMapSecurityConfig = { serviceHost: config.serviceHost };
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-trip-amap]");
      if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("高德地图加载失败。")), { once: true }); return; }
      const script = document.createElement("script"); script.dataset.tripAmap = "true"; script.src = `https://webapi.amap.com/maps?v=${encodeURIComponent(config.version || "2.0")}&key=${encodeURIComponent(config.key)}`; script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("高德地图加载失败。")); document.head.appendChild(script);
    });
    if (!window.AMap) throw new Error("高德地图加载失败。"); return window.AMap;
  })();
  return loader;
}

const modeLabels: Record<AMapRouteMode, string> = { walking: "步行", transit: "公交", driving: "驾车", bicycling: "骑行" };
function minutes(seconds: number | null) { return seconds == null ? "时间未知" : `${Math.max(1, Math.round(seconds / 60))} 分钟`; }
function distance(meters: number | null) { return meters == null ? "距离未知" : meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`; }

export function GenericTripMap({ slug, initial }: { slug: string; initial: MapWorkspace }) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<AMapObject | null>(null), overlays = useRef<unknown[]>([]);
  const [workspace, setWorkspace] = useState(initial), [dayId, setDayId] = useState(initial.days[0]?.id || ""), [originId, setOriginId] = useState(""), [destinationId, setDestinationId] = useState(""), [mode, setMode] = useState<AMapRouteMode>("walking"), [route, setRoute] = useState<AMapRouteResult | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [routing, setRouting] = useState(false);
  const day = workspace.days.find((item) => item.id === dayId) || workspace.days[0], places = useMemo(() => day?.places.map((item) => item.place) || [], [day]);
  const selectedOriginId = places.some((place) => place.id === originId) ? originId : places[0]?.id || "", selectedDestinationId = places.some((place) => place.id === destinationId) ? destinationId : places.find((place) => place.id !== selectedOriginId)?.id || "";
  const allPlaces = useMemo(() => { const unique = new Map<string, MapPlace>(); workspace.days.flatMap((item) => item.places).forEach((item) => unique.set(item.place.id, item.place)); return [...unique.values()].filter((item) => item.latitude != null && item.longitude != null); }, [workspace]);

  useEffect(() => { const listener = (event: Event) => setWorkspace((event as CustomEvent<MapWorkspace>).detail); window.addEventListener("trip-place-workspace", listener); return () => window.removeEventListener("trip-place-workspace", listener); }, []);
  useEffect(() => { let cancelled = false; if (!container.current) return; loadAMap().then((AMap) => { if (cancelled || !container.current) return; mapRef.current = new AMap.Map(container.current, { zoom: 11, center: [121.47, 31.23], viewMode: "2D" }); setLoading(false); }).catch((caught) => { if (!cancelled) { setError(caught instanceof Error ? caught.message : "地图加载失败。"); setLoading(false); } }); return () => { cancelled = true; mapRef.current?.destroy(); mapRef.current = null; }; }, []);
  useEffect(() => { const map = mapRef.current, AMap = window.AMap; if (!map || !AMap) return; if (overlays.current.length) map.remove(overlays.current); const markers = allPlaces.map((place, index) => new AMap.Marker({ position: [place.longitude!, place.latitude!], title: place.name, label: { content: `${index + 1}. ${place.name}`, direction: "top" } })); const lines = (route?.polylines || []).map((path) => new AMap.Polyline({ path, strokeColor: "#bf6648", strokeWeight: 6, strokeOpacity: 0.9, showDir: true })); overlays.current = [...markers, ...lines]; if (overlays.current.length) { map.add(overlays.current); map.setFitView(overlays.current); } }, [allPlaces, route]);

  async function plan() { setRouting(true); setError(""); try { const response = await fetch("/api/amap/routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, originPlaceId: selectedOriginId, destinationPlaceId: selectedDestinationId, mode }) }), payload = await response.json() as { route?: AMapRouteResult; error?: string }; if (!response.ok || !payload.route) throw new Error(payload.error || "路线规划失败。"); setRoute(payload.route); } catch (caught) { setError(caught instanceof Error ? caught.message : "路线规划失败。"); setRoute(null); } finally { setRouting(false); } }

  return <div className="generic-trip-map">
    <div className="map-toolbar"><label>Day<select value={day?.id || ""} onChange={(event) => { setDayId(event.target.value); setOriginId(""); setDestinationId(""); setRoute(null); }}>{workspace.days.map((item) => <option key={item.id} value={item.id}>Day {item.dayNumber}</option>)}</select></label><label>起点<select value={selectedOriginId} onChange={(event) => setOriginId(event.target.value)}><option value="">请选择</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>终点<select value={selectedDestinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">请选择</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
    <div className="route-modes">{(Object.keys(modeLabels) as AMapRouteMode[]).map((item) => <button type="button" className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{modeLabels[item]}</button>)}<button type="button" className="route-submit" disabled={!selectedOriginId || !selectedDestinationId || selectedOriginId === selectedDestinationId || routing} onClick={plan}>{routing ? "规划中…" : "规划路线"}</button></div>
    <div className="amap-canvas-wrap"><div ref={container} className="amap-canvas" aria-label="高德地图" />{loading && <p className="map-state">地图加载中…</p>}{!loading && !allPlaces.length && <p className="map-state">先从高德搜索并添加至少一个地点。</p>}</div>
    {route && <div className="route-summary"><b>{modeLabels[route.mode]}</b><span>{distance(route.distanceMeters)}</span><span>{minutes(route.durationSeconds)}</span>{route.transitCost != null && <span>公交约 ¥{route.transitCost}</span>}{route.taxiCost != null && <span>打车参考 ¥{route.taxiCost}</span>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
