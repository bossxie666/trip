type City = { id: string; name: string };
type Place = { cityId?: string | null; name?: string; district?: string | null };

// Old bookmarked filters remain valid; new filters use real city IDs.
const legacyNames: Record<string, string> = { shanghai: "上海", hangzhou: "杭州", tonglu: "杭州" };
export function mapAreaCity(area: string, cities: City[]) {
  return cities.find(city => city.id === area)
    || cities.find(city => legacyNames[area] && city.name.replace(/市$/, "") === legacyNames[area]);
}
export function normalizeMapArea(area: string | undefined, cities: City[]) {
  if (!area || area === "all") return "all";
  const city = mapAreaCity(area, cities);
  return city ? area === "tonglu" ? "tonglu" : city.id : "all";
}
export function matchesMapArea(place: Place, area: string, cities: City[]) {
  if (area === "all") return true;
  const city = mapAreaCity(area, cities);
  if (!city || place.cityId !== city.id) return false;
  return area !== "tonglu" || `${place.name || ""} ${place.district || ""}`.includes("桐庐");
}
export function mapAreaOptions(cities: City[], places: Place[], area: string) {
  const options = [{ key: "all", label: "全部" }, ...cities.map(city => ({ key: city.id, label: city.name }))];
  // Only show the legacy subregion when it actually belongs to this trip.
  if (mapAreaCity("tonglu", cities) && (area === "tonglu" || places.some(place => matchesMapArea(place, "tonglu", cities)))) options.push({ key: "tonglu", label: "桐庐" });
  return options;
}
