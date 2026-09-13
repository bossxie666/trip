export type AMapPoiCandidate = {
  id: string;
  name: string;
  address: string | null;
  longitude: number;
  latitude: number;
  adcode: string | null;
  cityCode: string | null;
  district: string | null;
  cityName: string | null;
  provinceName: string | null;
  typeCode: string | null;
};

export type AMapRouteMode = "walking" | "subway" | "bus" | "mixed_transit" | "taxi" | "driving" | "bicycling" | "transit";

export type RouteQuote = {
  amountMinor: number | null;
  currency: "CNY";
  basis: "per_person" | "per_vehicle" | "free" | "unknown";
  source: "amap";
  mode: AMapRouteMode;
  durationSeconds: number | null;
  distanceMeters: number | null;
  quotedAt: string;
};

export type TransitLeg = {
  mode: "walking" | "subway" | "bus" | "rail" | "taxi" | "other";
  instruction: string | null;
  lineName: string | null;
  rawType: string | null;
  direction: string | null;
  stationCount: number | null;
  departureStop: string | null;
  arrivalStop: string | null;
  /** Compatibility aliases for existing consumers. */
  fromStation?: string | null;
  toStation?: string | null;
  transfer?: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  polyline: [number, number][];
};

export type AMapRouteStep = TransitLeg;

export type AMapRouteResult = {
  mode: AMapRouteMode;
  distanceMeters: number | null;
  durationSeconds: number | null;
  taxiCost: number | null;
  transitCost: number | null;
  quote?: RouteQuote;
  polylines: [number, number][][];
  steps?: TransitLeg[];
  summary?: string | null;
};
