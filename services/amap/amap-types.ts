export type AMapPoiCandidate = {
  id: string;
  name: string;
  address: string | null;
  longitude: number;
  latitude: number;
  adcode: string | null;
  cityCode: string | null;
  district: string | null;
  typeCode: string | null;
};

export type AMapRouteMode = "walking" | "subway" | "bus" | "mixed_transit" | "taxi" | "driving" | "bicycling" | "transit";

export type AMapRouteStep = {
  mode: "walking" | "subway" | "bus" | "taxi" | "other";
  instruction: string | null;
  lineName: string | null;
  direction: string | null;
  stationCount: number | null;
  fromStation?: string | null;
  toStation?: string | null;
  transfer?: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  polyline: [number, number][];
};

export type AMapRouteResult = {
  mode: AMapRouteMode;
  distanceMeters: number | null;
  durationSeconds: number | null;
  taxiCost: number | null;
  transitCost: number | null;
  polylines: [number, number][][];
  steps?: AMapRouteStep[];
  summary?: string | null;
};
