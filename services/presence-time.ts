/** Render stored UTC instants in the trip's timezone, never the device timezone. */
export function presenceLocalTime(value: string | null | undefined, timezone: string) {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  } catch { return ""; }
}
