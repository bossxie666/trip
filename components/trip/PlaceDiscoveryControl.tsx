"use client";

import { useState } from "react";
import { GenericPlacePicker, type GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";

export function PlaceDiscoveryControl({ slug, days, existingPlaces = [] }: { slug: string; days: { id: string; label: string }[]; existingPlaces?: GenericPlaceChoice[] }) {
  const [open, setOpen] = useState(false), [place, setPlace] = useState<GenericPlaceChoice | null>(null), [dayId, setDayId] = useState(days[0]?.id || ""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const modalOwner = `place-discovery:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  const placeBody = () => place?.source === "existing" ? { placeId: place.id } : { providerPlaceId: place?.providerPlaceId || place?.id };
  async function act(mode: "saved" | "day") { if (!place) { setError("请先选择一个真实地点。"); return; } setSaving(true); setError(""); try { const response = await fetch(mode === "saved" ? `/api/trips/${encodeURIComponent(slug)}/saved-places` : `/api/trips/${encodeURIComponent(slug)}/plan/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "saved" ? placeBody() : { ...placeBody(), dayId, itemType: "place", title: place.name }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "保存失败"); location.reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); setSaving(false); } }
  return <><button type="button" className="add-itinerary-button" onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>找想去的地方</button>{open && <div className="plan-add-modal" role="dialog" aria-modal="true" aria-label="找想去的地方"><div className="plan-add-sheet"><header><div><span>PLACE PICKER</span><h3>搜索真实地点</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="关闭">×</button></header><GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} />{days.length > 0 && <label>目标 Day<select value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>}{error && <p className="form-error" role="alert">{error}</p>}<div className="edit-actions"><button type="button" disabled={saving} onClick={() => act("saved")}>想去</button>{days.length > 0 && <button type="button" className="plan-add-submit" disabled={saving} onClick={() => act("day")}>加入 Day</button>}</div></div></div>}</>;
}
