export type AtlasCity = {
  cityId: string;
  name: string;
  slug: string;
  centerLat: number | null;
  centerLng: number | null;
  tripStatus?: string;
};

export function hasCityCoordinates(city: AtlasCity): city is AtlasCity & { centerLat: number; centerLng: number } {
  return typeof city.centerLat === "number" && Number.isFinite(city.centerLat)
    && typeof city.centerLng === "number" && Number.isFinite(city.centerLng)
    && city.centerLat >= -90 && city.centerLat <= 90 && city.centerLng >= -180 && city.centerLng <= 180;
}

/** The printed China illustration is a summary. Accurate navigation uses AMap. */
export function projectAtlasCities(cities: AtlasCity[]) {
  return cities.filter(hasCityCoordinates)
    .filter((city) => city.centerLng >= 73 && city.centerLng <= 135 && city.centerLat >= 18 && city.centerLat <= 54)
    .map((city) => ({ ...city, x: 9 + (city.centerLng - 73) / 62 * 82, y: 86 - (city.centerLat - 18) / 36 * 72 }));
}
