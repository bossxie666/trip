"use client";

import { useEffect, useRef, useState } from "react";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";

type City = { id: string; name: string };
type Place = { id: string; name: string; address: string | null; cityId: string } | null;
type Slot = "place" | "origin" | "destination";
type SearchResult = { id: string; name: string; address: string | null; district: string | null; longitude: number; latitude: number };

export function BookingPlaceControl({ slug, bookingId, slot, cities, currentPlace, currentLabel = null, label = "修改地点", defaultCityId }: { slug: string; bookingId: string; slot: Slot; cities: City[]; currentPlace: Place; currentLabel?: string | null; label?: string; defaultCityId?: string | null }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [open, setOpen] = useState(false), [cityId, setCityId] = useState(defaultCityId || currentPlace?.cityId || cities[0]?.id || ""), [keywords, setKeywords] = useState(""), [results, setResults] = useState<SearchResult[]>([]), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const searching = useRef<AbortController | null>(null), submitting = useRef(false);
  const modalOwner = `booking-place:${bookingId}:${slot}`;
  useEffect(() => () => searching.current?.abort(), []);
  function close() { if (submitting.current) return; searching.current?.abort(); setOpen(false); setLoading(false); }
  useExclusiveTripModal(modalOwner, close);
  function show() {
    requestTripModalOpen(modalOwner); setCityId(defaultCityId || currentPlace?.cityId || cities[0]?.id || "");
    setKeywords(""); setResults([]); setError(""); setOpen(true);
  }
  async function search() {
    if (!keywords.trim() || !cityId) { setError("请输入名称并选择城市。"); return; }
    searching.current?.abort(); const controller = new AbortController(); searching.current = controller;
    setLoading(true); setError(""); setResults([]);
    try {
      const params = new URLSearchParams({ keywords: keywords.trim(), cityId, tripSlug: slug });
      const payload = await editorRequest<{ pois?: SearchResult[] }>(`/api/amap/places/search?${params}`, { signal: controller.signal });
      if (!controller.signal.aborted) { setResults(payload.pois || []); if (!payload.pois?.length) setError("没有找到地点，请换个名称搜索。"); }
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "地点搜索失败，请重试。"); }
    finally { if (searching.current === controller) setLoading(false); }
  }
  async function apply(providerPlaceId: string | null) {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError(""); searching.current?.abort();
    try {
      let placeId: string | null = null;
      if (providerPlaceId) {
        const payload = await editorRequest<{ place?: { id: string } }>(`/api/trips/${encodeURIComponent(slug)}/plan/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerPlaceId, cityId }) });
        if (!payload.place) throw new Error("地点保存失败，请重试。");
        placeId = payload.place.id;
      }
      const field = slot === "origin" ? "origin" : slot === "destination" ? "destination" : "place";
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(bookingId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [field]: placeId ? { placeId } : null }) });
      setOpen(false); refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "地点更新失败，请重试。"); }
    finally { submitting.current = false; setSaving(false); setLoading(false); }
  }
  return <>
    <button type="button" className="inline-edit-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={show}>{label}</button>
    <EditorDialog open={open} title={label} onClose={close} busy={saving}>
      {currentPlace && <p>当前地点：{currentPlace.name}</p>}
      <label>城市<select value={cityId} onChange={event => { searching.current?.abort(); setCityId(event.target.value); setResults([]); }}>{cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <div className="booking-place-search"><input value={keywords} onChange={event => { searching.current?.abort(); setKeywords(event.target.value); setResults([]); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder={currentPlace?.name || currentLabel || "输入酒店、机场或车站"} aria-label="搜索绑定地点" /><button type="button" disabled={loading} onClick={() => void search()}>{loading ? "搜索中…" : "搜索"}</button></div>
      {results.length > 0 && <ul className="booking-place-results">{results.map(result => <li key={result.id}><div><b>{result.name}</b><small>{[result.district, result.address].filter(Boolean).join(" · ")}</small></div><button type="button" onClick={() => void apply(result.id)}>绑定</button></li>)}</ul>}
      {currentPlace && <button type="button" onClick={() => void apply(null)}>解除地点关联</button>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </EditorDialog>
  </>;
}
