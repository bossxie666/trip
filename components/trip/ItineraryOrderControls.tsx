"use client";
import { useState } from "react";

export function ItineraryOrderControls({ slug, dayId, itemId, itemIds, locked }: { slug: string; dayId: string; itemId: string; itemIds: string[]; locked: boolean }) {
  const [busy, setBusy] = useState(false), index = itemIds.indexOf(itemId);
  async function move(delta: number) {
    const target = index + delta; if (locked || target < 0 || target >= itemIds.length || busy) return;
    const next = [...itemIds]; [next[index], next[target]] = [next[target], next[index]]; setBusy(true);
    try { const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/items`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, orderedItemIds: next }) }); if (!response.ok) throw new Error("排序失败"); location.reload(); } catch { setBusy(false); }
  }
  return <div className="item-order-controls" aria-label="调整行程顺序"><button type="button" aria-label="上移" disabled={locked || busy || index <= 0} onClick={() => move(-1)}>↑</button><button type="button" aria-label="下移" disabled={locked || busy || index < 0 || index >= itemIds.length - 1} onClick={() => move(1)}>↓</button>{locked && <small>已锁定</small>}</div>;
}
