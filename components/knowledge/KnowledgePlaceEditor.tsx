"use client";
import { useState } from "react";
import { GenericPlacePicker, type GenericPlaceChoice } from "@/components/trip/GenericPlacePicker";
import type { KnowledgePlaceChoice } from "@/services/knowledge-service.server";

export function KnowledgePlaceEditor({ places, onChange, disabled, onBusyChange }: { places: KnowledgePlaceChoice[]; onChange: (places: KnowledgePlaceChoice[]) => void; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const [choice, setChoice] = useState<GenericPlaceChoice | null>(null), [error, setError] = useState("");
  async function add() {
    if (!choice || disabled || places.length >= 24) return;
    onBusyChange(true); setError("");
    try {
      const response = await fetch("/api/knowledge/places", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ providerPlaceId: choice.providerPlaceId }) });
      const payload = await response.json() as { place?: KnowledgePlaceChoice; message?: string };
      if (!response.ok || !payload.place) throw new Error(payload.message || "地点添加失败。");
      if (!places.some((place) => place.id === payload.place!.id)) onChange([...places, payload.place]);
      setChoice(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "地点添加失败，请重试。"); }
    finally { onBusyChange(false); }
  }
  return <section className="knowledge-place-editor" aria-label="关联真实地点"><b>关联地点</b>
    <ul>{places.map((place) => <li key={place.id}><span>{place.name}<small>{place.address}</small></span><button type="button" disabled={disabled} aria-label={`移除地点 ${place.name}`} onClick={() => onChange(places.filter((item) => item.id !== place.id))}>×</button></li>)}</ul>
    <GenericPlacePicker slug="" showExisting={false} searchEndpoint="/api/knowledge/places" value={choice} onChange={setChoice} placeholder="搜索真实地点" />
    <button type="button" disabled={!choice || disabled || places.length >= 24} onClick={add}>{choice ? `添加 ${choice.name}` : "选择搜索结果后添加"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
