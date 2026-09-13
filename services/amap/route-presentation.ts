import type { AMapRouteMode, AMapRouteResult, TransitLeg } from "./amap-types";
import { createAmapRouteQuote, routeQuoteLabel } from "./route-quote.ts";

const modeLabels: Partial<Record<AMapRouteMode, string>> = { transit: "公共交通", taxi: "打车", walking: "步行", bicycling: "骑行" };

export function localRouteModeLabel(mode: AMapRouteMode) { return modeLabels[mode] || "公共交通"; }
export function routeMinutes(seconds: number | null) { return seconds == null ? null : `${Math.max(1, Math.round(seconds / 60))}分钟`; }
export function routeDistance(meters: number | null) { return meters == null ? null : meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`; }
export function routeFare(route: AMapRouteResult) {
  return routeQuoteLabel(route.quote || createAmapRouteQuote({ mode: route.mode, transitCost: route.transitCost, taxiCost: route.taxiCost, durationSeconds: route.durationSeconds, distanceMeters: route.distanceMeters }));
}

export function transitLineSummary(legs: TransitLeg[] = []) {
  return legs.filter((leg) => leg.mode === "subway" || leg.mode === "rail" || leg.mode === "bus" || isFerryLeg(leg)).map((leg) => isFerryLeg(leg) ? leg.lineName || "轮渡" : leg.lineName).filter((name): name is string => Boolean(name)).filter((name, index, all) => index === 0 || name !== all[index - 1]).join(" → ");
}

export function isFerryLeg(leg: Pick<TransitLeg, "rawType" | "lineName" | "instruction">) {
  return /ferry|boat|ship|轮渡|渡船|客轮/i.test([leg.rawType, leg.lineName, leg.instruction].filter(Boolean).join(" "));
}
