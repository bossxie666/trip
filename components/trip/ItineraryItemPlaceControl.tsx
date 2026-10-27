"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";

type City = { id: string; name: string };
type Place = { id: string; name: string; address: string | null; cityId: string; latitude: number | null; longitude: number | null; providerPlaceId?: string | null };
type Poi = { id: string; name: string; address: string | null; district: string | null; longitude: number; latitude: number };

export function ItineraryItemPlaceControl({ slug, itemId, cities, currentPlace, defaultCityId }: { slug: string; itemId: string; cities: City[]; currentPlace: Place | null; defaultCityId?: string }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [open, setOpen] = useState(false), [cityId, setCityId] = useState(defaultCityId || currentPlace?.cityId || cities[0]?.id || ""), [keywords, setKeywords] = useState(currentPlace?.name || ""), [results, setResults] = useState<Poi[]>([]), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false), modalOwner = `item-place:${itemId}`;
  function close() { if (!submitting.current) setOpen(false); }
  useExclusiveTripModal(modalOwner, close);
  useEffect(() => {
    if (!open || !keywords.trim() || !cityId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const query = new URLSearchParams({ keywords: keywords.trim(), cityId, tripSlug: slug });
        const payload = await editorRequest<{ pois?: Poi[] }>(`/api/amap/places/search?${query}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResults(payload.pois || []);
      } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "地点搜索失败，请重试。"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [cityId, keywords, open, slug]);
  async function bind(providerPlaceId: string) {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const result = await editorRequest<{ place?: Place }>(`/api/trips/${encodeURIComponent(slug)}/plan/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerPlaceId, cityId }) });
      if (!result.place) throw new Error("地点保存失败，请重试。");
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/plan/items/${encodeURIComponent(itemId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId: result.place.id }) });
      setOpen(false); refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "行程地点绑定失败，请重试。"); }
    finally { submitting.current = false; setSaving(false); }
  }
  const label = currentPlace ? "修改地点" : "完善地点";
  return <>
    <button type="button" className="inline-edit-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { requestTripModalOpen(modalOwner); setCityId(defaultCityId || currentPlace?.cityId || cities[0]?.id || ""); setKeywords(currentPlace?.name || ""); setResults([]); setLoading(false); setError(""); setOpen(true); }}>{label}</button>
    <EditorDialog open={open} title={label} onClose={close} busy={saving}>
      <label>城市<select value={cityId} onChange={event => { setCityId(event.target.value); setResults([]); setLoading(false); }}>{cities.map(city => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label>
      <label>搜索地点<input value={keywords} onChange={event => { setKeywords(event.target.value); setResults([]); setLoading(false); }} placeholder="输入地点名称" /></label>
      {loading && <small role="status">搜索中…</small>}
      {results.length > 0 && <ul className="booking-place-results">{results.map(poi => <li key={poi.id}><span><b>{poi.name}</b><small>{[poi.district, poi.address].filter(Boolean).join(" · ")}</small></span><button type="button" onClick={() => void bind(poi.id)}>绑定</button></li>)}</ul>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </EditorDialog>
  </>;
}
