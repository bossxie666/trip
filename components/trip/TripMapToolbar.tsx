"use client";
import { useRouter } from "next/navigation";

export function TripMapToolbar({ slug, trips, days, dayId, mode }: { slug: string; trips: { slug: string; title: string }[]; days: { id: string; date: string | null; dayNumber: number }[]; dayId: string; mode: string }) {
  const router = useRouter();
  function change(key: string, value: string) {
    const query = new URLSearchParams(window.location.search);
    query.set("view", "map");
    if (key === "trip") router.push(`/trips/${encodeURIComponent(value)}/plan?view=map`);
    else { query.set(key, value); router.push(`/trips/${encodeURIComponent(slug)}/plan?${query.toString()}`); }
  }
  return <div className="standalone-map-toolbar">
    <label>旅行<select aria-label="选择地图行程" value={slug} onChange={event => change("trip", event.target.value)}>{trips.map(trip => <option key={trip.slug} value={trip.slug}>{trip.title}</option>)}</select></label>
    <label>日期<select aria-label="选择地图日期" value={dayId} onChange={event => change("day", event.target.value)}>{days.map(day => <option key={day.id} value={day.id}>{day.date?.slice(5) || `Day ${day.dayNumber}`}</option>)}</select></label>
    <label>视图<select aria-label="选择地图视图" value={mode} onChange={event => change("mode", event.target.value)}><option value="day">行程路线</option><option value="library">攻略地图</option></select></label>
  </div>;
}
