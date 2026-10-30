"use client";
import { useRef, useState } from "react";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";

export function ManualMapPointEditor({ slug, point, cities, defaultCityId, bookings, onClose, onSaved }: {
  slug: string; point: { longitude: number; latitude: number }; cities: { id: string; name: string }[];
  defaultCityId: string; bookings: { id: string; title: string }[]; onClose: (hasSavedChanges: boolean) => void; onSaved: () => void;
}) {
  const [name, setName] = useState(""), [address, setAddress] = useState(""), [cityId, setCityId] = useState(defaultCityId);
  const [bookingId, setBookingId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null), [saved, setSaved] = useState(false);
  const running = useRef(false), createdPlace = useRef<string | null>(null), attached = useRef(false);
  async function submit() {
    if (running.current) return;
    if (!name.trim() || !cities.some(city => city.id === cityId)) { setError("请填写名称并选择城市。"); return; }
    running.current = true; setBusy(true); setError("");
    try {
      if (!createdPlace.current) {
        const result = await editorRequest<{ place?: { id: string } }>(`/api/trips/${encodeURIComponent(slug)}/plan/places`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim(), address: address.trim() || null, cityId, ...point }),
        });
        if (!result.place?.id) throw new Error("手动地点保存失败，请重试。");
        createdPlace.current = result.place.id; setPlaceId(result.place.id);
      }
      if (!attached.current) {
        await editorRequest(`/api/trips/${encodeURIComponent(slug)}/saved-places`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId: createdPlace.current }),
        });
        attached.current = true; setSaved(true);
      }
      if (bookingId) await editorRequest(`/api/trips/${encodeURIComponent(slug)}/budget/bookings/${encodeURIComponent(bookingId)}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId: createdPlace.current }),
      });
      onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "手动地点保存失败，请重试。"); }
    finally { running.current = false; setBusy(false); }
  }
  return <EditorDialog open title="手动地图选点" onClose={() => onClose(Boolean(placeId))} busy={busy}
    dirty={Boolean(name || address || bookingId || cityId !== defaultCityId || placeId)}
    discardMessage={saved ? "地点已保留在暂存地点中，订单绑定尚未完成。关闭不会删除已保存的地点。" : placeId ? "地点已创建，但尚未加入旅行暂存地点。关闭将结束本次编辑。" : undefined}
    onSubmit={submit} submitLabel={saved && bookingId ? "重试绑定订单" : "保存地点"}>
    <p>坐标：{point.longitude.toFixed(5)}, {point.latitude.toFixed(5)}</p>
    <label>城市<select aria-label="城市" disabled={!!placeId} value={cityId} onChange={event => setCityId(event.target.value)}>{cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
    <label>名称<input disabled={!!placeId} required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="例如：集合点" /></label>
    <label>地址或备注<input disabled={!!placeId} maxLength={500} value={address} onChange={event => setAddress(event.target.value)} /></label>
    {bookings.length > 0 && <label>同时绑定订单<select aria-label="同时绑定订单" value={bookingId} onChange={event => setBookingId(event.target.value)}><option value="">不绑定订单</option>{bookings.map(booking => <option key={booking.id} value={booking.id}>{booking.title}</option>)}</select></label>}
    {placeId && <p role="status">{saved ? "地点已加入暂存地点。" : "地点已创建，重试会继续加入当前旅行。"}</p>}
    {error && <p role="alert">{error}</p>}
  </EditorDialog>;
}
