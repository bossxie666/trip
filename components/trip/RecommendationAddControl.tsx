"use client";
import { useState } from "react";

export function RecommendationAddControl({ slug, recommendationId, days, defaultDayId, addedDayIds }: { slug: string; recommendationId: string; days: { id: string; label: string }[]; defaultDayId: string; addedDayIds: string[] }) {
  const [dayId, setDayId] = useState(defaultDayId), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function add() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recommendationId, dayId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "加入失败");
      location.assign(`/trips/${encodeURIComponent(slug)}/plan?view=planning&day=${encodeURIComponent(dayId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "加入失败"); setSaving(false); }
  }
  const alreadyAdded = addedDayIds.includes(dayId);
  return <div className="recommendation-add"><select aria-label="选择目标日期" value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select><button type="button" onClick={add} disabled={saving}>{saving ? "加入中…" : alreadyAdded ? "再次加入" : "加入 Day"}</button>{error && <small role="alert">{error}</small>}</div>;
}
