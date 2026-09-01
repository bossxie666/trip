"use client";

type Entry = { source: "itinerary" | "booking"; sourceId: string; anchorKind?: string | null };

export function TimelinePlacementControl({ slug, dayId, entries, index }: { slug: string; dayId: string; entries: Entry[]; index: number }) {
  const move = async (direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const next = entries.map((entry) => ({ ...entry }));
    [next[index], next[target]] = [next[target], next[index]];
    const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/timeline`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, entries: next }) });
    if (response.ok) location.reload();
  };
  return <span className="timeline-placement-controls" aria-label="调整 Booking Anchor 位置"><button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="Booking Anchor 上移">↑</button><button type="button" onClick={() => move(1)} disabled={index === entries.length - 1} aria-label="Booking Anchor 下移">↓</button></span>;
}
