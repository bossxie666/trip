"use client";

import { useState } from "react";

/** Edits only the booking display title; place/date/amount facts stay intact. */
export function BookingDisplayNameControl({ slug, bookingId, initialTitle }: { slug: string; bookingId: string; initialTitle: string }) {
  const [title, setTitle] = useState(initialTitle), [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function save() {
    const next = title.trim();
    if (!next) { setError("名称不能为空。"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/budget/bookings/${encodeURIComponent(bookingId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: next }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "酒店名称保存失败。");
      setOpen(false);
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "酒店名称保存失败。");
      setSaving(false);
    }
  }
  return <details className="booking-display-name-control" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
    <summary>编辑名称</summary>
    <div>
      <label>展示名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存名称"}</button>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  </details>;
}
