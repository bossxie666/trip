"use client";
import { FormEvent, useMemo, useState } from "react";

type Place = { id: string; name: string; cityId: string; address: string | null; latitude?: number | null; longitude?: number | null; coordinateSystem?: string | null; provider?: string | null };
type Workspace = { cities: { id: string; name: string }[]; availablePlaces: Place[]; days: { id: string; dayNumber: number; date: string | null; title: string; places: { sortOrder: number; planStatus?: "candidate" | "selected" | "locked"; place: Place }[] }[] };
type Poi = { id: string; name: string; address: string | null; district: string | null };

export function DayPlacesEditor({ slug, initial }: { slug: string; initial: Workspace }) {
  const [workspace, setWorkspace] = useState(initial), [openDay, setOpenDay] = useState<string | null>(null), [mode, setMode] = useState<"amap" | "existing" | "new">("amap");
  const [placeId, setPlaceId] = useState(""), [name, setName] = useState(""), [cityId, setCityId] = useState(initial.cities[0]?.id || ""), [address, setAddress] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState(""), [pois, setPois] = useState<Poi[]>([]), [poiId, setPoiId] = useState(""), [searching, setSearching] = useState(false);
  const placeCount = useMemo(() => new Set(workspace.days.flatMap((day) => day.places.map((item) => item.place.id))).size, [workspace]);
  async function request(url: string, init: RequestInit) {
    const response = await fetch(url, init); const payload = await response.json() as { workspace?: Workspace; error?: string };
    if (!response.ok) throw new Error(payload.error || "地点操作失败。"); if (payload.workspace) { setWorkspace(payload.workspace); window.dispatchEvent(new CustomEvent("trip-place-workspace", { detail: payload.workspace })); } return payload;
  }
  async function add(event: FormEvent, dayId: string) {
    event.preventDefault(); setSaving(true); setError("");
    try { await request(`/api/trips/${slug}/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "new" ? { action: "create", dayId, name, cityId, address } : mode === "amap" ? { action: "create-amap", dayId, cityId, providerPlaceId: poiId } : { action: "existing", dayId, placeId }) }); setOpenDay(null); setName(""); setAddress(""); setPlaceId(""); setKeywords(""); setPois([]); setPoiId(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "添加失败。"); } finally { setSaving(false); }
  }
  async function searchPoi() { setSearching(true); setError(""); try { const response = await fetch(`/api/amap/places/search?keywords=${encodeURIComponent(keywords)}&cityId=${encodeURIComponent(cityId)}`), payload = await response.json() as { pois?: Poi[]; error?: string }; if (!response.ok) throw new Error(payload.error || "搜索失败。"); setPois(payload.pois || []); setPoiId(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "搜索失败。"); } finally { setSearching(false); } }
  async function move(dayId: string, ids: string[], from: number, delta: number) {
    const to = from + delta; if (to < 0 || to >= ids.length) return; [ids[from], ids[to]] = [ids[to], ids[from]];
    try { setError(""); await request(`/api/trips/${slug}/places`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, orderedPlaceIds: ids }) }); } catch (caught) { setError(caught instanceof Error ? caught.message : "排序失败。"); }
  }
  async function remove(dayId: string, id: string) { try { setError(""); await request(`/api/trips/${slug}/places?dayId=${encodeURIComponent(dayId)}&placeId=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch (caught) { setError(caught instanceof Error ? caught.message : "移除失败。"); } }
  if (!workspace.days.length) return <div className="day-place-empty"><p>这条行程还没有 Day。确定日期后会生成日程，再添加地点。</p></div>;
  return <div className="day-places-editor">
    {workspace.days.map((day) => { const ids = day.places.map((item) => item.place.id); return <article key={day.id} className="day-place-card">
      <header><div><b>Day {day.dayNumber}</b>{day.date && <span>{day.date}</span>}</div><button type="button" onClick={() => setOpenDay(openDay === day.id ? null : day.id)}>＋ 添加地点</button></header>
      {!day.places.length ? <p>这一天还没有地点。</p> : <ol>{day.places.map((item, index) => <li key={item.place.id}><span>{index + 1}</span><div><b>{item.place.name}</b><small>{item.place.address || "暂无地址"}</small></div><div><button aria-label="上移" disabled={index === 0} onClick={() => move(day.id, [...ids], index, -1)}>↑</button><button aria-label="下移" disabled={index === ids.length - 1} onClick={() => move(day.id, [...ids], index, 1)}>↓</button><button onClick={() => remove(day.id, item.place.id)}>移除</button></div></li>)}</ol>}
      {openDay === day.id && <form className="add-place-panel" onSubmit={(event) => add(event, day.id)}><div className="place-mode"><button type="button" className={mode === "amap" ? "active" : ""} onClick={() => setMode("amap")}>搜索高德地点</button><button type="button" className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>选择已有地点</button><button type="button" className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>手工地点</button></div>{mode === "amap" ? <><label>城市<select required value={cityId} onChange={(event) => { setCityId(event.target.value); setPois([]); setPoiId(""); }}>{workspace.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><div><span className="field-label">地点关键词</span><div className="poi-search-row"><input aria-label="地点关键词" required value={keywords} placeholder="酒店、车站、景点或餐厅" onChange={(event) => setKeywords(event.target.value)} /><button type="button" disabled={!keywords.trim() || searching} onClick={searchPoi}>{searching ? "搜索中…" : "搜索"}</button></div></div>{pois.length > 0 && <div className="poi-results" role="radiogroup" aria-label="高德地点搜索结果">{pois.map((poi) => <label aria-label={poi.name} key={poi.id} className={poiId === poi.id ? "selected" : ""}><input required type="radio" name={`poi-${day.id}`} value={poi.id} checked={poiId === poi.id} onChange={() => setPoiId(poi.id)} /><span><b>{poi.name}</b><small>{[poi.district, poi.address].filter(Boolean).join(" · ") || "暂无详细地址"}</small></span></label>)}</div>}</> : mode === "existing" ? <label>地点<select required value={placeId} onChange={(event) => setPlaceId(event.target.value)}><option value="">请选择</option>{workspace.availablePlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label> : <><label>地点名称<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>城市<select required value={cityId} onChange={(event) => setCityId(event.target.value)}>{workspace.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><label>地址（可选）<input value={address} onChange={(event) => setAddress(event.target.value)} /></label></>}<button className="save-place" disabled={saving || (mode === "amap" && !poiId)}>{saving ? "保存中…" : "保存到 Day"}</button></form>}
    </article>; })}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="place-map-note">已添加 {placeCount} 个地点；候选地点仅作参考，已选或锁定地点才会进入正式路线。</p>
  </div>;
}
