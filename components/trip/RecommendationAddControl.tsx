"use client";
import { useState } from "react";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

export function RecommendationAddControl({ slug, recommendationId, kind, options = [], placeId, days, defaultDayId, addedDayIds }: { slug: string; recommendationId: string; kind?: "place" | "guide"; options?: { id: string; placeId: string; name: string }[]; placeId?: string | null; days: { id: string; label: string }[]; defaultDayId: string; addedDayIds: string[] }) {
  const { openPlanningDay, refreshWorkspace } = useWorkspaceNavigation();
  const [dayId, setDayId] = useState(defaultDayId), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>(() => options.map((option) => option.placeId));
  async function add() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recommendationId, dayId, componentPlaceIds: kind === "guide" ? selectedPlaceIds : undefined }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "加入失败");
      openPlanningDay(slug, dayId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "加入失败"); }
    finally { setSaving(false); }
  }
  const alreadyAdded = addedDayIds.includes(dayId);
  async function saveForLater() { if (!placeId) { setError("这条素材还没有可收藏的真实地点。"); return; } setSaving(true); setError(""); try { const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/saved-places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "收藏失败"); refreshWorkspace(); } catch (caught) { setError(caught instanceof Error ? caught.message : "收藏失败"); } finally { setSaving(false); } }
  return <div className="recommendation-add">{kind === "guide" && <fieldset className="guide-component-picker"><legend>选择加入的地点</legend>{options.map((option) => <label key={option.id}><input type="checkbox" checked={selectedPlaceIds.includes(option.placeId)} onChange={(event) => setSelectedPlaceIds((current) => event.target.checked ? [...new Set([...current, option.placeId])] : current.filter((id) => id !== option.placeId))} />{option.name}</label>)}</fieldset>}<select aria-label="选择目标日期" value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select>{kind !== "guide" && placeId && <button type="button" onClick={saveForLater} disabled={saving}>想去</button>}<button type="button" onClick={add} disabled={saving || (kind === "guide" && selectedPlaceIds.length === 0)}>{saving ? "加入中…" : alreadyAdded ? "再次加入" : kind === "guide" ? "加入所选地点" : "加入 Day"}</button>{error && <small role="alert">{error}</small>}</div>;
}
