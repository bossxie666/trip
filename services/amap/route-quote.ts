import type { AMapRouteMode, RouteQuote } from "./amap-types.ts";

const transitModes = new Set<AMapRouteMode>(["transit", "subway", "bus", "mixed_transit"]);

export function createAmapRouteQuote(input: { mode: AMapRouteMode; transitCost: number | null; taxiCost: number | null; durationSeconds: number | null; distanceMeters: number | null; quotedAt?: string }): RouteQuote {
  const shared = { currency: "CNY" as const, source: "amap" as const, mode: input.mode, durationSeconds: input.durationSeconds, distanceMeters: input.distanceMeters, quotedAt: input.quotedAt || new Date().toISOString() };
  if (input.mode === "walking" || input.mode === "bicycling") return { ...shared, amountMinor: 0, basis: "free" };
  if (transitModes.has(input.mode)) return { ...shared, amountMinor: input.transitCost == null ? null : Math.round(input.transitCost * 100), basis: input.transitCost == null ? "unknown" : "per_person" };
  if (input.mode === "taxi" || input.mode === "driving") return { ...shared, amountMinor: input.taxiCost == null ? null : Math.round(input.taxiCost * 100), basis: input.taxiCost == null ? "unknown" : "per_vehicle" };
  return { ...shared, amountMinor: null, basis: "unknown" };
}

export function routeQuoteLabel(quote: RouteQuote | null | undefined) {
  if (!quote || quote.basis === "unknown" || quote.amountMinor == null) return "费用暂缺";
  if (quote.basis === "free") return "¥0";
  const amount = (quote.amountMinor / 100).toFixed(2).replace(/\.00$/, "");
  return `约 ¥${amount}/${quote.basis === "per_person" ? "人" : "车"}`;
}
