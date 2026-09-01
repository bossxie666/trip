"use client";

import { useState, type DragEvent } from "react";

/**
 * Desktop-friendly drag target for one itinerary item.  The mobile order
 * buttons remain the primary touch affordance; this handle only adds the
 * optional HTML5 drag path and delegates the authoritative reorder to the
 * same server endpoint.
 */
export function ItineraryDragHandle({ slug, dayId, itemId, itemIds, locked }: { slug: string; dayId: string; itemId: string; itemIds: string[]; locked: boolean }) {
  const [busy, setBusy] = useState(false);
  async function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData("text/plain");
    const from = itemIds.indexOf(draggedId), to = itemIds.indexOf(itemId);
    if (locked || busy || !draggedId || from < 0 || to < 0 || from === to) return;
    const ordered = [...itemIds]; ordered.splice(from, 1); ordered.splice(to, 0, draggedId);
    setBusy(true);
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/items`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, orderedItemIds: ordered }) });
      if (!response.ok) throw new Error("排序失败");
      location.reload();
    } catch {
      setBusy(false);
    }
  }
  return <button type="button" className="item-drag-handle" draggable={!locked && !busy} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", itemId); }} onDragOver={(event) => event.preventDefault()} onDrop={drop} disabled={locked || busy} aria-label={locked ? "已锁定，不能拖动" : "拖动调整顺序"}>{busy ? "…" : locked ? "锁定" : "⠿ 拖动"}</button>;
}
