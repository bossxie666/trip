"use client";

import { useEffect, useRef, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";
import { localRouteModeLabel, routeDistance, routeFare, routeMinutes, transitLineSummary } from "@/services/amap/route-presentation";

type Point = { id: string; source: "itinerary" | "booking"; placeId: string; title: string };
const choices: Array<{ mode: AMapRouteMode; label: string }> = [{ mode: "transit", label: "公共交通" }, { mode: "taxi", label: "打车" }, { mode: "walking", label: "步行" }, { mode: "bicycling", label: "骑行" }];

export function LocalRouteSegmentControl({ slug, dayId, edgeId, from, to, initialMode }: { slug: string; dayId: string; edgeId: string; from: Point; to: Point; initialMode: AMapRouteMode | null }) {
  const [mode, setMode] = useState<AMapRouteMode | null>(initialMode), [route, setRoute] = useState<AMapRouteResult | null>(null), [detailFailed, setDetailFailed] = useState(false), [editing, setEditing] = useState(!initialMode), [pending, setPending] = useState(false), [error, setError] = useState("");
  const requestRef = useRef(0);
  async function loadRoute(nextMode: AMapRouteMode, signal?: AbortSignal) {
    const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/routes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originPlaceId: from.placeId, destinationPlaceId: to.placeId, mode: nextMode }), signal });
    const payload = await response.json() as { route?: AMapRouteResult; error?: string };
    if (!response.ok || !payload.route) throw new Error(payload.error || "路线暂时无法计算。");
    return payload.route;
  }
  useEffect(() => {
    if (!initialMode) return;
    const controller = new AbortController(), request = ++requestRef.current;
    const timer = window.setTimeout(() => { if (request === requestRef.current) setDetailFailed(true); controller.abort(); }, 12000);
    void loadRoute(initialMode, controller.signal).then((result) => { if (request === requestRef.current) setRoute(result); }).catch(() => { if (request === requestRef.current && !controller.signal.aborted) setDetailFailed(true); }).finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  // Endpoint identity is the segment identity; do not refetch for unrelated renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId, edgeId, initialMode]);
  async function choose(nextMode: AMapRouteMode) {
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await loadRoute(nextMode);
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/preferences`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, fromSource: from.source, fromId: from.id, toSource: to.source, toId: to.id, preferredMode: nextMode }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "路线选择保存失败。");
      setMode(nextMode); setRoute(result); setDetailFailed(false); setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "路线选择保存失败。"); }
    finally { setPending(false); }
  }
  const summary = route ? [localRouteModeLabel(mode || route.mode), routeMinutes(route.durationSeconds), routeDistance(route.distanceMeters), routeFare(route)].filter(Boolean).join(" · ") : mode ? `${localRouteModeLabel(mode)} · ${detailFailed ? "路线详情暂不可用" : "路线详情读取中"}` : null;
  return <>
    <div className="local-route-rail" aria-hidden="true"><span /></div>
    <div className="local-route-content">
      {!editing && summary ? <><b>{summary}</b><div className="local-route-detail"><span>{route ? transitLineSummary(route.steps || []) : ""}</span><button type="button" onClick={() => setEditing(true)}>修改</button></div></> : <><button className="local-route-trigger" type="button" onClick={() => setEditing((value) => !value)}>＋ 选择交通方式</button>{editing && <div className="local-route-choices">{choices.map((choice) => <button disabled={pending} type="button" key={choice.mode} onClick={() => void choose(choice.mode)}>{pending ? "处理中…" : choice.label}</button>)}</div>}</>}
      {error && <p role="alert">{error}</p>}
    </div>
  </>;
}
