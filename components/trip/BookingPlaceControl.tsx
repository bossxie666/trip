"use client";

import { useState } from "react";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";

type City = { id: string; name: string };
type Place = { id: string; name: string; address: string | null; cityId: string } | null;
type Slot = "place" | "origin" | "destination";
type SearchResult = { id: string; name: string; address: string | null; district: string | null; longitude: number; latitude: number };

/**
 * Small, reusable booking-location editor.  It deliberately owns no map
 * state: the server remains the source of truth and AMap search results are
 * converted to a Place before the booking is patched.  This control is also
 * used for pending hotel/transport endpoints, so an unknown endpoint is an
 * explicit state rather than a guessed airport.
 */
export function BookingPlaceControl({ slug, bookingId, slot, cities, currentPlace, currentLabel = null, label = "修改地点", defaultCityId }: { slug: string; bookingId: string; slot: Slot; cities: City[]; currentPlace: Place; currentLabel?: string | null; label?: string; defaultCityId?: string | null }) {
  const [open, setOpen] = useState(false), [cityId, setCityId] = useState(defaultCityId || currentPlace?.cityId || cities[0]?.id || ""), [keywords, setKeywords] = useState(""), [results, setResults] = useState<SearchResult[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const modalOwner = `booking-place:${bookingId}:${slot}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));

  async function search() {
    if (!keywords.trim() || !cityId) { setError("请输入名称并选择城市。"); return; }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ keywords: keywords.trim(), cityId, tripSlug: slug });
      const response = await fetch(`/api/amap/places/search?${params.toString()}`);
      const payload = await response.json() as { pois?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "高德搜索失败，请稍后重试。");
      setResults(payload.pois || []);
      if (!payload.pois?.length) setError("没有找到候选地点，可在地图中选点后再绑定。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "高德搜索失败，请稍后重试。"); }
    finally { setLoading(false); }
  }

  async function bind(providerPlaceId: string) {
    setLoading(true); setError("");
    try {
      const placeResponse = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerPlaceId, cityId }) });
      const placePayload = await placeResponse.json() as { place?: { id: string }; error?: string };
      if (!placeResponse.ok || !placePayload.place) throw new Error(placePayload.error || "地点保存失败。");
      const field = slot === "origin" ? "origin" : slot === "destination" ? "destination" : "place";
      const bookingResponse = await fetch(`/api/trips/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(bookingId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [field]: { placeId: placePayload.place.id } }) });
      const bookingPayload = await bookingResponse.json() as { error?: string };
      if (!bookingResponse.ok) throw new Error(bookingPayload.error || "订单地点绑定失败。");
      location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "订单地点绑定失败。"); setLoading(false); }
  }

  async function clearBinding() {
    setLoading(true); setError("");
    try {
      const field = slot === "origin" ? "origin" : slot === "destination" ? "destination" : "place";
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(bookingId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [field]: null }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "清除地点失败。");
      location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "清除地点失败。"); setLoading(false); }
  }

  return <details className="booking-place-control" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
    <summary onClick={() => { if (!open) requestTripModalOpen(modalOwner); }}>{label}</summary>
    <div className="booking-place-editor">
      <label>城市<select value={cityId} onChange={(event) => setCityId(event.target.value)}>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <div className="booking-place-search"><input value={keywords} onChange={(event) => setKeywords(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder={currentPlace?.name || currentLabel || "输入酒店 / 机场 / 车站"} aria-label="搜索绑定地点"/><button type="button" onClick={() => void search()} disabled={loading}>{loading ? "搜索中…" : "搜索"}</button></div>
      {results.length ? <ul className="booking-place-results">{results.map((result) => <li key={result.id}><div><b>{result.name}</b><small>{[result.district, result.address].filter(Boolean).join(" · ") || "暂无地址"}</small></div><button type="button" onClick={() => void bind(result.id)} disabled={loading}>绑定</button></li>)}</ul> : null}
      {currentPlace && <button type="button" className="booking-place-clear" onClick={() => void clearBinding()} disabled={loading}>清除具体地点</button>}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <small>未找到时可保留文字标签；绑定不会改变订单日期、金额或费用分摊。</small>
    </div>
  </details>;
}
