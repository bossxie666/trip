"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";

type MapPlace = { id: string; name: string; latitude: number | null; longitude: number | null; candidate: boolean; order: number | null };
type AMapObject = { add(value: unknown): void; remove(value: unknown): void; setFitView(value?: unknown[]): void; destroy(): void };
type AMapNamespace = { Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapObject; Marker: new (options: Record<string, unknown>) => unknown; Polyline: new (options: Record<string, unknown>) => unknown };
declare global { interface Window { AMap?: AMapNamespace; _AMapSecurityConfig?: { serviceHost: string } } }

let loader: Promise<AMapNamespace> | null = null;
async function loadAMap() {
  if (window.AMap) return window.AMap;
  if (!loader) loader = (async () => {
    const response = await fetch("/api/amap/config"), config = await response.json() as { key?: string; version?: string; serviceHost?: string; error?: string };
    if (!response.ok || !config.key || !config.serviceHost) throw new Error(config.error || "地图配置读取失败。");
    window._AMapSecurityConfig = { serviceHost: config.serviceHost };
    await new Promise<void>((resolve, reject) => { const existing = document.querySelector<HTMLScriptElement>("script[data-trip-amap]"); if (existing) { if (window.AMap) resolve(); else { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("高德地图加载失败。")), { once: true }); } return; } const script = document.createElement("script"); script.dataset.tripAmap = "true"; script.src = `https://webapi.amap.com/maps?v=${encodeURIComponent(config.version || "2.0")}&key=${encodeURIComponent(config.key)}`; script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("高德地图加载失败。")); document.head.appendChild(script); });
    if (!window.AMap) throw new Error("高德地图加载失败。"); return window.AMap;
  })();
  return loader;
}

const labels: Record<AMapRouteMode, string> = { walking: "步行", transit: "公共交通", driving: "驾车", bicycling: "骑行" };
export function PlanMap({ slug, places }: { slug: string; places: MapPlace[] }) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<AMapObject | null>(null), overlays = useRef<unknown[]>([]);
  const visible = useMemo(() => places.filter((place) => place.latitude != null && place.longitude != null), [places]);
  const routePlaces = visible.filter((place) => !place.candidate);
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [origin, setOrigin] = useState(routePlaces[0]?.id || ""), [destination, setDestination] = useState(routePlaces[1]?.id || ""), [mode, setMode] = useState<AMapRouteMode>("walking"), [route, setRoute] = useState<AMapRouteResult | null>(null), [routing, setRouting] = useState(false);
  useEffect(() => { let cancelled = false; loadAMap().then((AMap) => { if (cancelled || !container.current) return; mapRef.current = new AMap.Map(container.current, { zoom: 11, center: [121.47, 31.23], viewMode: "2D" }); setReady(true); }).catch((caught) => setError(caught instanceof Error ? caught.message : "地图加载失败。")); return () => { cancelled = true; mapRef.current?.destroy(); mapRef.current = null; }; }, []);
  useEffect(() => { const map = mapRef.current, AMap = window.AMap; if (!ready || !map || !AMap) return; if (overlays.current.length) map.remove(overlays.current); const markers = visible.map((place, index) => new AMap.Marker({ position: [place.longitude!, place.latitude!], title: place.name, opacity: place.candidate ? .45 : 1, label: { content: `${place.order ?? index + 1}. ${place.name}`, direction: "top" } })); const lines = (route?.polylines || []).map((path) => new AMap.Polyline({ path, strokeColor: "#b9674c", strokeWeight: 6, strokeOpacity: .9, showDir: true })); overlays.current = [...markers, ...lines]; if (overlays.current.length) { map.add(overlays.current); map.setFitView(overlays.current); } }, [ready, route, visible]);
  async function plan() { setRouting(true); setError(""); try { const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/routes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originPlaceId: origin, destinationPlaceId: destination, mode }) }); const payload = await response.json() as { route?: AMapRouteResult; error?: string }; if (!response.ok || !payload.route) throw new Error(payload.error || "路线规划失败。"); setRoute(payload.route); } catch (caught) { setRoute(null); setError(caught instanceof Error ? caught.message : "路线规划失败。"); } finally { setRouting(false); } }
  return <div className="plan-map"><div className="plan-map-controls"><label>起点<select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="">请选择</option>{routePlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>终点<select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">请选择</option>{routePlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div><div className="route-modes">{(["walking", "transit", "driving"] as AMapRouteMode[]).map((value) => <button type="button" key={value} className={mode === value ? "active" : ""} onClick={() => setMode(value)}>{labels[value]}</button>)}<button type="button" className="route-submit" disabled={!origin || !destination || origin === destination || routing} onClick={plan}>{routing ? "规划中…" : "规划路线"}</button></div><div className="plan-map-canvas-wrap"><div ref={container} className="plan-map-canvas" aria-label="高德地图" />{!ready && !error && <p>地图加载中…</p>}{ready && !visible.length && <p>当前视图还没有已绑定坐标的地点。</p>}</div>{route && <div className="route-summary"><b>{labels[route.mode]}</b><span>{route.distanceMeters == null ? "距离未知" : `${(route.distanceMeters / 1000).toFixed(1)} 公里`}</span><span>{route.durationSeconds == null ? "时间未知" : `${Math.max(1, Math.round(route.durationSeconds / 60))} 分钟`}</span></div>}{error && <p className="form-error" role="alert">{error}</p>}<p className="map-candidate-note">淡色 Marker 是攻略候选地点，不会自动进入当天路线。</p></div>;
}
