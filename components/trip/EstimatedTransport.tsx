"use client";

import { useMemo, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";

type Stop = { id: string; title: string; place: { id: string; cityId: string }; memberStates?: Record<string, "present" | "absent" | "unknown"> };
type Segment = { id: string; from: Stop; to: Stop; crossCity: boolean };
type Day = { id: string; label: string };
type Preference = { dayId: string; fromId: string; toId: string; memberId: string | null; preferredMode: AMapRouteMode };

const modeLabels: Record<AMapRouteMode, string> = { walking: "步行", subway: "公共交通", bus: "公共交通", mixed_transit: "公共交通", taxi: "打车", driving: "驾车", bicycling: "骑行", transit: "公共交通" };
const minutes = (seconds: number | null) => seconds == null ? "时间待确认" : `${Math.max(1, Math.round(seconds / 60))} 分钟`;
const distance = (meters: number | null) => meters == null ? "距离待确认" : meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`;
function estimatedMinor(route: AMapRouteResult, segment: Segment, memberId: string | null | undefined) {
  if (route.mode === "walking") return 0;
  if (route.mode === "taxi") {
    if (route.taxiCost == null) return null;
    const states = Object.values(segment.from.memberStates || {}).filter((state) => state === "present").length;
    if (!memberId || segment.from.memberStates?.[memberId] !== "present" || !states) return null;
    return Math.round((route.taxiCost * 100) / states);
  }
  return route.transitCost == null ? null : Math.round(route.transitCost * 100);
}

export function EstimatedTransport({ slug, days, segmentsByDay, preferences, currentMemberId }: { slug: string; days: Day[]; segmentsByDay?: Record<string, Segment[]>; preferences?: Preference[]; currentMemberId?: string | null }) {
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
  const knownEstimate = Object.values(results).length;
  const segmentEstimates = segments.map(({ segment }) => { const route = results[segment.id]; return route ? estimatedMinor(route, segment, currentMemberId) : null; });
  const knownTotal = segmentEstimates.reduce((sum, value) => sum + (value ?? 0), 0), missingEstimate = segmentEstimates.some((value) => value == null);
  const totalLabel = !knownEstimate ? "路线估算，不会写入实际消费" : missingEstimate ? `已知约 ¥${(knownTotal / 100).toFixed(2).replace(/\.00$/, "")} · 其余待确认` : `当前已知约 ¥${(knownTotal / 100).toFixed(2).replace(/\.00$/, "")}`;
  return <section className="budget-estimated-transport"><header><div><span>ROUTE ESTIMATE</span><h3>预计市内交通</h3></div><small>{knownEstimate ? totalLabel : "路线估算，不会写入实际消费"}</small></header>{!segments.length ? <p className="budget-muted">暂无可估算的市内路线。先在“行程路线”中安排两个带坐标的地点。</p> : <><p className="budget-estimated-copy">当前偏好仅作为计划参考；实际支付请回到预算页点击“＋记一笔”。跨城交通不在这里自动估算。</p><button type="button" className="budget-secondary" onClick={loadEstimates} disabled={loading}>{loading ? "读取路线中…" : knownEstimate ? "刷新路线估算" : "读取路线估算"}</button>{error ? <p className="budget-error" role="alert">{error}</p> : null}<div className="budget-estimate-list">{segments.map(({ day, segment }) => { const route = results[segment.id], mode = route?.mode || preferenceFor(day.id, segment); const presence = currentMemberId ? segment.from.memberStates?.[currentMemberId] || segment.to.memberStates?.[currentMemberId] || "unknown" : "unknown"; return <article key={segment.id}><div><b>{day.label} · {segment.from.title} → {segment.to.title}</b><small>{modeLabels[mode]} · {presence === "unknown" ? "参与成员待确认" : presence === "absent" ? "当前成员不计入" : "当前成员参与"}</small></div>{route ? <strong>{route.mode === "taxi" ? (route.taxiCost != null ? `约 ¥${route.taxiCost}/车` : "车费待确认") : route.mode === "walking" ? "¥0" : route.transitCost != null ? `约 ¥${route.transitCost}/人` : "票价待确认"}<small>{minutes(route.durationSeconds)} · {distance(route.distanceMeters)}</small></strong> : <strong className="pending">未读取</strong>}</article>; })}</div></>}</section>;
}
