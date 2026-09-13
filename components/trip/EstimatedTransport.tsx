"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AMapRouteMode, AMapRouteResult } from "@/services/amap/amap-types";
import { createAmapRouteQuote, routeQuoteLabel } from "@/services/amap/route-quote";
import { estimateTransportCost, mergeTransportParticipantStates, type TransportParticipantState } from "@/services/transport-estimate";

type Stop = { id: string; title: string; place: { id: string; cityId: string }; memberStates?: Record<string, TransportParticipantState> };
type Segment = { id: string; from: Stop; to: Stop; crossCity: boolean };
type Day = { id: string; label: string };
type Preference = { dayId: string; fromId: string; toId: string; memberId: string | null; preferredMode: AMapRouteMode };
export type EstimateSnapshot = { knownMinor: number; pendingCount: number; loadedCount: number };

const modeLabels: Partial<Record<AMapRouteMode, string>> = { transit: "公共交通", subway: "公共交通", bus: "公共交通", mixed_transit: "公共交通", taxi: "打车", walking: "步行", bicycling: "骑行" };
const minutes = (seconds: number | null) => seconds == null ? "时间待确认" : `${Math.max(1, Math.round(seconds / 60))} 分钟`;
const distance = (meters: number | null) => meters == null ? "距离待确认" : meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`;

export function EstimatedTransport({ slug, days, segmentsByDay, preferences, currentMemberId, onEstimateChange }: { slug: string; days: Day[]; segmentsByDay?: Record<string, Segment[]>; preferences?: Preference[]; currentMemberId?: string | null; onEstimateChange?: (snapshot: EstimateSnapshot) => void }) {
  const selectedSegments = useMemo(() => days.flatMap((day) => (segmentsByDay?.[day.id] || []).filter((segment) => !segment.crossCity).flatMap((segment) => {
    const preference = preferences?.find((entry) => entry.dayId === day.id && entry.fromId === segment.from.id && entry.toId === segment.to.id && entry.memberId === currentMemberId);
    return preference ? [{ day, segment, mode: preference.preferredMode }] : [];
  })), [currentMemberId, days, preferences, segmentsByDay]);
  const [results, setResults] = useState<Record<string, AMapRouteResult>>({}), [failures, setFailures] = useState<Record<string, true>>({}), [loading, setLoading] = useState(false);
  const loadEstimates = useCallback(async () => {
    if (!selectedSegments.length) return;
    setLoading(true);
    try {
      const settled = await Promise.all(selectedSegments.map(async ({ segment, mode }) => {
        try {
          const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/routes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originPlaceId: segment.from.place.id, destinationPlaceId: segment.to.place.id, mode }), signal: AbortSignal.timeout(10_000) });
          const payload = await response.json() as { route?: AMapRouteResult; error?: string };
          if (!response.ok || !payload.route) throw new Error(payload.error || "路线估算失败");
          return { id: segment.id, route: payload.route };
        } catch { return { id: segment.id, route: null }; }
      }));
      setResults(Object.fromEntries(settled.filter((entry) => entry.route).map((entry) => [entry.id, entry.route!] as const)));
      setFailures(Object.fromEntries(settled.filter((entry) => !entry.route).map((entry) => [entry.id, true] as const)));
    } finally { setLoading(false); }
  }, [selectedSegments, slug]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEstimates(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadEstimates]);

  const snapshot = useMemo<EstimateSnapshot>(() => {
    let knownMinor = 0, pendingCount = 0, loadedCount = 0;
    for (const { segment } of selectedSegments) {
      const route = results[segment.id];
      if (!route) { pendingCount += 1; continue; }
      loadedCount += 1;
      const estimate = estimateTransportCost({ mode: route.mode, transitCost: route.transitCost, taxiCost: route.taxiCost, memberId: currentMemberId, memberStates: mergeTransportParticipantStates(segment.from.memberStates, segment.to.memberStates) });
      if (estimate.amountMinor == null) pendingCount += 1; else knownMinor += estimate.amountMinor;
    }
    return { knownMinor, pendingCount, loadedCount };
  }, [currentMemberId, results, selectedSegments]);
  useEffect(() => { onEstimateChange?.(snapshot); }, [onEstimateChange, snapshot]);
  const totalLabel = snapshot.pendingCount ? `已知约 ¥${(snapshot.knownMinor / 100).toFixed(2).replace(/\.00$/, "")} · 其余为参考/待确认` : `当前已知约 ¥${(snapshot.knownMinor / 100).toFixed(2).replace(/\.00$/, "")}`;
  return <section className="budget-estimated-transport"><header><div><span>ROUTE ESTIMATE</span><h3>预计市内交通</h3></div><small>{snapshot.loadedCount ? totalLabel : "路线估算不会写入实际消费"}</small></header>{!selectedSegments.length ? <p className="budget-muted">尚未选择市内交通方式。请先在规划中选择相邻地点的交通方式。</p> : <><p className="budget-estimated-copy">来自 RoutePreference 与高德实时参考报价；不会创建 Expense，跨城 Booking 也不会在此重复计费。</p><button type="button" className="budget-secondary" onClick={() => void loadEstimates()} disabled={loading}>{loading ? "读取路线中…" : "刷新路线估算"}</button><div className="budget-estimate-list">{selectedSegments.map(({ day, segment, mode }) => {
    const route = results[segment.id], memberStates = mergeTransportParticipantStates(segment.from.memberStates, segment.to.memberStates), presence = currentMemberId ? memberStates[currentMemberId] || "unknown" : "unknown";
    const quote = route ? route.quote || createAmapRouteQuote({ mode: route.mode, transitCost: route.transitCost, taxiCost: route.taxiCost, durationSeconds: route.durationSeconds, distanceMeters: route.distanceMeters }) : null;
    const estimate = route ? estimateTransportCost({ mode: route.mode, transitCost: route.transitCost, taxiCost: route.taxiCost, memberId: currentMemberId, memberStates }) : null;
    const amountLabel = presence === "absent"
      ? "当前成员不计入"
      : quote?.basis === "per_vehicle"
        ? routeQuoteLabel(quote)
        : estimate?.reason === "participants"
          ? `${routeQuoteLabel(quote)} · 个人计入待确认`
          : routeQuoteLabel(quote);
    return <article key={segment.id}><div><b>{day.label} · {segment.from.title} → {segment.to.title}</b><small>{modeLabels[mode] || "公共交通"} · {presence === "unknown" || presence === "partial" ? "参与成员待确认" : presence === "absent" ? "当前成员不参与" : "当前成员参与"}</small></div>{route ? <strong>{amountLabel}<small>{minutes(route.durationSeconds)} · {distance(route.distanceMeters)}</small></strong> : <strong className="pending">{failures[segment.id] ? "费用暂缺" : "读取中…"}</strong>}</article>;
  })}</div></>}</section>;
}
