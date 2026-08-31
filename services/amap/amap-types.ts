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

export type AMapRouteMode = "walking" | "driving" | "bicycling" | "transit";

export type AMapRouteResult = {
  mode: AMapRouteMode;
  distanceMeters: number | null;
  durationSeconds: number | null;
  taxiCost: number | null;
  transitCost: number | null;
  polylines: [number, number][][];
};
