/** Official-ish line colors used only for subway legs.  City is part of the
 * key because line numbers are reused between Shanghai and Hangzhou. */
export const SUBWAY_LINE_COLORS: Record<string, string> = {
  "Shanghai::2号线": "#79C267",
  "Shanghai::11号线": "#87189D",
  "Hangzhou::1号线": "#E6002D",
  "Hangzhou::2号线": "#F7B500",
};

export const SUBWAY_NEUTRAL = "#8B8B8B";
export const BUS_NEUTRAL = "#8B8B8B";
export const ROUTE_DEFAULT = "#BF6648";

function canonicalCity(city: string | null | undefined) {
  if (!city) return null;
  if (city.includes("上海") || city.toLowerCase() === "shanghai") return "Shanghai";
  if (city.includes("杭州") || city.toLowerCase() === "hangzhou") return "Hangzhou";
  return city;
}

function canonicalLine(line: string | null | undefined) {
  if (!line) return null;
  const normalized = line.replace(/\s+/g, "").replace(/地铁/g, "");
  const match = normalized.match(/(\d+号线)/);
  return match?.[1] || null;
}

export function subwayLineColor(city: string | null | undefined, line: string | null | undefined) {
  const cityKey = canonicalCity(city), lineKey = canonicalLine(line);
  return cityKey && lineKey ? SUBWAY_LINE_COLORS[`${cityKey}::${lineKey}`] || SUBWAY_NEUTRAL : SUBWAY_NEUTRAL;
}

/** Route-wide fallback: only an actual subway step can select a line color.
 * Bus, walking, taxi and unknown/mixed routes remain neutral. */
export function routeStrokeColor(mode: string, steps: Array<{ mode?: string; lineName?: string | null }> = [], city?: string | null) {
  if (mode !== "transit" && mode !== "subway" && mode !== "mixed_transit" && mode !== "bus") return ROUTE_DEFAULT;
  const subway = steps.find((step) => step.mode === "subway" && step.lineName);
  return subway ? subwayLineColor(city, subway.lineName) : BUS_NEUTRAL;
}
