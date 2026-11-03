type RoutePlace = { id: string; providerPlaceId?: string | null; latitude?: number | null; longitude?: number | null };

/** Identity or identical recorded coordinates, never just a matching place name. */
export function sameRoutePlace(from: RoutePlace, to: RoutePlace) {
  if ((from.id && from.id === to.id) || (from.providerPlaceId && from.providerPlaceId === to.providerPlaceId)) return true;
  return from.latitude != null && from.longitude != null && to.latitude != null && to.longitude != null
    && Number.isFinite(from.latitude) && Number.isFinite(from.longitude) && Number.isFinite(to.latitude) && Number.isFinite(to.longitude)
    && Math.abs(from.latitude - to.latitude) < 0.000001 && Math.abs(from.longitude - to.longitude) < 0.000001;
}
