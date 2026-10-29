"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";
import type { PlaceDiscoveryProps } from "./PlaceDiscoveryControl";
import type { GenericPlaceChoice } from "./GenericPlacePicker";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then(module => module.GenericPlacePicker), { ssr: false });
type Mode = "saved" | "day";

export function PlaceDiscoveryEditor(props: PlaceDiscoveryProps & { onClose: () => void; onSaved: (mode: Mode, dayId: string) => void }) {
  const [{ slug, days, defaultDayId, existingPlaces = [] }] = useState(props);
  const initialDay = days.some(day => day.id === defaultDayId) ? defaultDayId! : days[0]?.id || "";
  const [dayId, setDayId] = useState(initialDay), [place, setPlace] = useState<GenericPlaceChoice | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  const dirty = Boolean(place) || dayId !== initialDay;
  async function act(mode: Mode) {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      if (!place) throw new Error("请先选择一个真实地点。");
      if (mode === "day" && !days.some(day => day.id === dayId)) throw new Error("请选择目标日期。");
      const body = place.source === "existing" ? { placeId: place.id } : { providerPlaceId: place.providerPlaceId || place.id };
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/${mode === "saved" ? "saved-places" : "plan/items"}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "saved" ? body : { ...body, dayId, itemType: "place", title: place.name }),
      });
      props.onSaved(mode, dayId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败，请重试。"); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <EditorDialog open title="找想去的地方" className="place-discovery-editor" onClose={props.onClose} dirty={dirty} busy={saving}
    onSubmit={() => act(days.length ? "day" : "saved")} submitLabel={days.length ? "加入行程" : "加入想去"}
    actions={days.length ? <button type="button" disabled={saving} onClick={() => void act("saved")}>加入想去</button> : null}>
    <GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} />
    {days.length > 0 && <label>目标日期<select value={dayId} onChange={event => setDayId(event.target.value)}>{days.map(day => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </EditorDialog>;
}
