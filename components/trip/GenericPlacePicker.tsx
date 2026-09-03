/* eslint-disable react-hooks/set-state-in-effect, jsx-a11y/no-autofocus */
"use client";

import { useEffect, useState } from "react";

export type GenericPlaceChoice = {
  id: string;
  name: string;
  address: string | null;
  district?: string | null;
  cityName?: string | null;
  providerPlaceId?: string | null;
  source: "existing" | "amap";
};

export function GenericPlacePicker({ slug, existing = [], value, onChange, autoFocus = false, showExisting = true, placeholder }: { slug: string; existing?: GenericPlaceChoice[]; value: GenericPlaceChoice | null; onChange: (place: GenericPlaceChoice | null) => void; autoFocus?: boolean; showExisting?: boolean; placeholder?: string }) {
  const [query, setQuery] = useState(""), [results, setResults] = useState<GenericPlaceChoice[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/amap/places/search?keywords=${encodeURIComponent(query.trim())}&tripSlug=${encodeURIComponent(slug)}`, { signal: controller.signal });
        const payload = await response.json() as { pois?: Array<Omit<GenericPlaceChoice, "source" | "providerPlaceId">>; error?: string };
        if (!response.ok) throw new Error(payload.error || "地点搜索失败");
        setResults((payload.pois || []).map((poi) => ({ ...poi, providerPlaceId: poi.id, source: "amap" })));
      } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "地点搜索失败"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, slug]);
  const choices = query.trim() ? results : showExisting ? existing : [];
  return <div className="generic-place-picker">
    <input value={query} onChange={(event) => { setQuery(event.target.value); onChange(null); }} placeholder={placeholder || "搜索酒店、机场、车站、景点、餐厅…"} aria-label="搜索真实地点" autoFocus={autoFocus} />
    {!query.trim() && showExisting && existing.length > 0 && <small>最近使用 · 当前住宿 · 想去地点</small>}
    {loading && <small>搜索中…</small>}{error && <p className="form-error" role="alert">{error}</p>}
    {choices.length > 0 && <div className="plan-add-pois" role="radiogroup" aria-label="地点搜索结果">{choices.map((place) => <label aria-label={`选择 ${place.name}`} key={`${place.source}-${place.id}`} className={value?.id === place.id && value.source === place.source ? "selected" : ""}><input type="radio" name="generic-place" checked={value?.id === place.id && value.source === place.source} onChange={() => onChange(place)} /><span><b>{place.name}</b><small>{[place.cityName, place.district, place.address].filter(Boolean).join(" · ") || "暂无地址"}</small></span></label>)}</div>}
  </div>;
}
