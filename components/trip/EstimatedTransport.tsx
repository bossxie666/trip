"use client";

import { useEffect, useMemo, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";
import { estimateTransportCost, mergeTransportParticipantStates, type TransportParticipantState } from "@/services/transport-estimate";

type Stop = { id: string; title: string; place: { id: string; cityId: string }; memberStates?: Record<string, TransportParticipantState> };
type Segment = { id: string; from: Stop; to: Stop; crossCity: boolean };
type Day = { id: string; label: string };
type Preference = { dayId: string; fromId: string; toId: string; memberId: string | null; preferredMode: AMapRouteMode };
export type EstimateSnapshot = { knownMinor: number; pendingCount: number; loadedCount: number };

const modeLabels: Record<AMapRouteMode, string> = { walking: "步行", subway: "公共交通", bus: "公共交通", mixed_transit: "公共交通", taxi: "打车", driving: "驾车", bicycling: "骑行", transit: "公共交通" };
const minutes = (seconds: number | null) => seconds == null ? "时间待确认" : `${Math.max(1, Math.round(seconds / 60))} 分钟`;
const distance = (meters: number | null) => meters == null ? "距离待确认" : meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`;
export function EstimatedTransport({ slug, days, segmentsByDay, preferences, currentMemberId, onEstimateChange }: { slug: string; days: Day[]; segmentsByDay?: Record<string, Segment[]>; preferences?: Preference[]; currentMemberId?: string | null; onEstimateChange?: (snapshot: EstimateSnapshot) => void }) {
  const segments = useMemo(() => days.flatMap((day) => (segmentsByDay?.[day.id] || []).filter((segment) => !segment.crossCity).map((segment) => ({ day, segment }))), [days, segmentsByDay]);
  const [results, setResults] = useState<Record<string, AMapRouteResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const preferenceFor = (dayId: string, segment: Segment) => preferences?.find((preference) => preference.dayId === dayId && preference.fromId === segment.from.id && preference.toId === segment.to.id && (preference.memberId === currentMemberId || (preference.memberId == null && currentMemberId == null)))?.preferredMode || "transit";
  async function loadEstimates() {
    if (!segments.length || loading) return;
    setLoading(true); setError("");
    try {
      const loaded = await Promise.all(segments.map(async ({ day, segment }) => {
        const mode = preferenceFor(day.id, segment);
        const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/routes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originPlaceId: segment.from.place.id, destinationPlaceId: segment.to.place.id, mode }) });
        const payload = await response.json() as { route?: AMapRouteResult; error?: string };
        if (!response.ok || !payload.route) throw new Error(payload.error || "路线估算失败");
        return [segment.id, payload.route] as const;
      }));
      setResults(Object.fromEntries(loaded));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "路线估算失败"); }
    finally { setLoading(false); }
  }
  const snapshot = useMemo<EstimateSnapshot>(() => {
    let knownMinor = 0;
    let pendingCount = 0;
    let loadedCount = 0;
    for (const { segment } of segments) {
      const route = results[segment.id];
      if (!route) continue;
      loadedCount += 1;
      const memberStates = mergeTransportParticipantStates(segment.from.memberStates, segment.to.memberStates);
      const estimate = estimateTransportCost({ mode: route.mode, transitCost: route.transitCost, taxiCost: route.taxiCost, memberId: currentMemberId, memberStates });
      if (estimate.amountMinor == null) pendingCount += 1;
      else knownMinor += estimate.amountMinor;
    }
    return { knownMinor, pendingCount, loadedCount };
  }, [currentMemberId, results, segments]);
  useEffect(() => { onEstimateChange?.(snapshot); }, [onEstimateChange, snapshot]);
  const knownEstimate = snapshot.loadedCount;
  const missingEstimate = snapshot.pendingCount > 0;
  const totalLabel = !knownEstimate ? "路线估算，不会写入实际消费" : missingEstimate ? `已知约 ¥${(snapshot.knownMinor / 100).toFixed(2).replace(/\.00$/, "")} · 其余待确认` : `当前已知约 ¥${(snapshot.knownMinor / 100).toFixed(2).replace(/\.00$/, "")}`;
  return <section className="budget-estimated-transport"><header><div><span>ROUTE ESTIMATE</span><h3>预计市内交通</h3></div><small>{knownEstimate ? totalLabel : "路线估算，不会写入实际消费"}</small></header>{!segments.length ? <p className="budget-muted">暂无可估算的市内路线。先在“行程路线”中安排两个带坐标的地点。</p> : <><p className="budget-estimated-copy">当前偏好仅作为计划参考；实际支付请回到预算页点击“＋记一笔”。跨城交通不在这里自动估算。</p><button type="button" className="budget-secondary" onClick={loadEstimates} disabled={loading}>{loading ? "读取路线中…" : knownEstimate ? "刷新路线估算" : "读取路线估算"}</button>{error ? <p className="budget-error" role="alert">{error}</p> : null}<div className="budget-estimate-list">{segments.map(({ day, segment }) => { const route = results[segment.id], mode = route?.mode || preferenceFor(day.id, segment); const memberStates = mergeTransportParticipantStates(segment.from.memberStates, segment.to.memberStates); const presence = currentMemberId ? memberStates[currentMemberId] || "unknown" : "unknown"; const estimate = route ? estimateTransportCost({ mode: route.mode, transitCost: route.transitCost, taxiCost: route.taxiCost, memberId: currentMemberId, memberStates }) : null; return <article key={segment.id}><div><b>{day.label} · {segment.from.title} → {segment.to.title}</b><small>{modeLabels[mode]} · {presence === "unknown" || presence === "partial" ? "参与成员待确认" : presence === "absent" ? "当前成员不计入" : "当前成员参与"}</small></div>{route ? <strong>{estimate?.pending ? "参与成员确认后计算" : route.mode === "taxi" ? (route.taxiCost != null ? `约 ¥${route.taxiCost}/车` : "车费待确认") : route.mode === "walking" || route.mode === "bicycling" ? "¥0" : route.transitCost != null ? `约 ¥${route.transitCost}/人` : "票价待确认"}<small>{minutes(route.durationSeconds)} · {distance(route.distanceMeters)}</small></strong> : <strong className="pending">未读取</strong>}</article>; })}</div></>}</section>;
}
