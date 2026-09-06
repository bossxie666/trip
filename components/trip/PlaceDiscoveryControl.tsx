"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then((module) => module.GenericPlacePicker), { ssr: false });
const WorkspaceOverlay = dynamic(() => import("./WorkspaceOverlay").then((module) => module.WorkspaceOverlay), { ssr: false });

export function PlaceDiscoveryControl({ slug, days, existingPlaces = [] }: { slug: string; days: { id: string; label: string }[]; existingPlaces?: GenericPlaceChoice[] }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [open, setOpen] = useState(false), [place, setPlace] = useState<GenericPlaceChoice | null>(null), [dayId, setDayId] = useState(days[0]?.id || ""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const modalOwner = `place-discovery:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  const placeBody = () => place?.source === "existing" ? { placeId: place.id } : { providerPlaceId: place?.providerPlaceId || place?.id };
  async function act(mode: "saved" | "day") { if (!place) { setError("请先选择一个真实地点。"); return; } setSaving(true); setError(""); try { const response = await fetch(mode === "saved" ? `/api/trips/${encodeURIComponent(slug)}/saved-places` : `/api/trips/${encodeURIComponent(slug)}/plan/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "saved" ? placeBody() : { ...placeBody(), dayId, itemType: "place", title: place.name }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "保存失败"); setOpen(false); refreshWorkspace(); } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); } finally { setSaving(false); } }
  return <><button type="button" className="add-itinerary-button button-primary" onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>找想去的地方</button>{open && <WorkspaceOverlay open={open} onClose={() => setOpen(false)} mode="modal" ariaLabel="找想去的地方" className="plan-add-sheet"><header><div><span>PLACE PICKER</span><h3>搜索真实地点</h3><p>选择真实地点后，可以先收藏或安排到某一天。</p></div><button type="button" className="workspace-close" onClick={() => setOpen(false)} aria-label="关闭">×</button></header><GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} />{days.length > 0 && <label className="plan-add-target-day"><span>目标 Day</span><select value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>}{error && <p className="form-error" role="alert">{error}</p>}<footer className="workspace-footer"><button type="button" className="button-secondary" disabled={saving} onClick={() => act("saved")}>想去</button>{days.length > 0 && <button type="button" className="plan-add-submit button-primary" disabled={saving} onClick={() => act("day")}>加入 Day</button>}</footer></WorkspaceOverlay>}</>;
}
