/** Keep the current trip's filters when a saved change opens a planning day. */
export function planningDayHref(currentHref: string | null, slug: string, dayId: string) {
  const pathname = `/trips/${encodeURIComponent(slug)}/plan`;
  let query = new URLSearchParams();
  if (currentHref) {
    try {
      const current = new URL(currentHref, "https://workspace.invalid");
      if (current.pathname.replace(/\/$/, "") === pathname) query = new URLSearchParams(current.search);
    } catch { /* A missing browser location must not prevent navigation. */ }
  }
  query.set("view", "planning");
  query.set("day", dayId);
  return `${pathname}?${query.toString()}`;
}
