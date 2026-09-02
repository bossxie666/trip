import type { AMapRouteMode } from "@/services/amap/amap-types";

export type TripIconKind =
  | "flight"
  | "high-speed-rail"
  | "train"
  | "transit"
  | "taxi"
  | "walking"
  | "bicycling"
  | "hotel"
  | "attraction"
  | "calendar";

/**
 * One deliberately quiet, outline icon family for itinerary and route UI.
 * Keeping the mapping here prevents emoji and ad-hoc glyphs from leaking into
 * individual cards while retaining the existing circular badge language.
 */
export function TransportIcon({ kind, size = 16, className = "" }: { kind: TripIconKind; size?: number; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" className={`trip-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24">
      {kind === "flight" ? <><path {...common} d="M3 13.2 21 6l-2.3 4.2-6.2 2.6-3.4 5.7-2-.8 1-5.3-5.1 1.5Z"/><path {...common} d="m11.8 12.8 3.4 3.2"/></> : null}
      {kind === "high-speed-rail" ? <><path {...common} d="M6 4.5h12v10.2c0 2-2.2 3.1-6 3.1s-6-1.1-6-3.1Z"/><path {...common} d="M6 9h12M8 20l2-2.2m6 2.2-2-2.2"/><circle cx="9" cy="14" r=".8" fill="currentColor"/><circle cx="15" cy="14" r=".8" fill="currentColor"/></> : null}
      {kind === "train" ? <><rect {...common} x="6" y="4" width="12" height="13" rx="3"/><path {...common} d="M6 10h12M8 20l2-3m6 3-2-3"/><circle cx="9" cy="13" r=".8" fill="currentColor"/><circle cx="15" cy="13" r=".8" fill="currentColor"/></> : null}
      {kind === "transit" ? <><path {...common} d="M5 5h14v11H5zM8 20l2-4m6 4-2-4M5 10h14"/><circle cx="9" cy="13" r=".8" fill="currentColor"/><circle cx="15" cy="13" r=".8" fill="currentColor"/></> : null}
      {kind === "taxi" ? <><path {...common} d="m5 10 2-4h10l2 4 1 1v6H4v-6Z"/><path {...common} d="M8 6h8M4 12h16"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></> : null}
      {kind === "walking" ? <><circle {...common} cx="13" cy="5" r="2"/><path {...common} d="m12 8-2 5 3 2 1 5m-4-7-3 4m5-4 4 1 2 4"/></> : null}
      {kind === "bicycling" ? <><circle {...common} cx="6" cy="17" r="3"/><circle {...common} cx="18" cy="17" r="3"/><path {...common} d="m6 17 4-7 3 7m-3-7h3l2 3m-5-3-2-2"/></> : null}
      {kind === "hotel" ? <><path {...common} d="M4 18V7m0 7h16v4M8 14V9h4c2 0 3 1 3 2v3M4 18h16"/><path {...common} d="M7 18v2m10-2v2"/></> : null}
      {kind === "attraction" ? <><path {...common} d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5M8 10h2m4 0h2"/></> : null}
      {kind === "calendar" ? <><rect {...common} x="4" y="5" width="16" height="15" rx="2"/><path {...common} d="M8 3v4m8-4v4M4 10h16"/><path {...common} d="M8 14h.1m3.9 0h.1m3.9 0h.1m-8 3h.1m3.9 0h.1"/></> : null}
    </svg>
  );
}

export function iconForBookingType(type: string, title = ""): TripIconKind {
  if (type === "flight") return "flight";
  if (type === "train") return /火车|普速/.test(title) ? "train" : "high-speed-rail";
  if (type === "hotel") return "hotel";
  return "calendar";
}

export function iconForItemType(type: string, title = "", note = ""): TripIconKind {
  const transportText = `${title}\n${note}`;
  if (type === "transit") {
    if (/飞机|航班/.test(transportText)) return "flight";
    if (/高铁|动车/.test(transportText)) return "high-speed-rail";
    if (/火车|普速/.test(transportText)) return "train";
    if (/打车|出租|驾车/.test(transportText)) return "taxi";
    if (/步行/.test(transportText)) return "walking";
    if (/骑行|自行车/.test(transportText)) return "bicycling";
    return "transit";
  }
  if (type === "lodging" || /酒店|住宿|入住/.test(title)) return "hotel";
  if (type === "place" || type === "activity" || type === "meal") return type === "meal" ? "attraction" : "attraction";
  return "calendar";
}

export function iconForTransportMode(mode: string): TripIconKind {
  if (mode === "flight") return "flight";
  if (mode === "high_speed_rail") return "high-speed-rail";
  if (mode === "train") return "train";
  if (mode === "taxi") return "taxi";
  if (mode === "walking") return "walking";
  if (mode === "bicycling") return "bicycling";
  if (mode === "transit") return "transit";
  return "calendar";
}

export function iconForRouteMode(mode: AMapRouteMode): TripIconKind {
  if (mode === "walking") return "walking";
  if (mode === "bicycling") return "bicycling";
  if (mode === "taxi" || mode === "driving") return "taxi";
  return "transit";
}
