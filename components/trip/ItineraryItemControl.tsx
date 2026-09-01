"use client";
import { useState } from "react";

type Item = { id: string; title: string; note: string | null; startTimeLocal: string | null; durationMinutes: number | null; dayId: string };

export function ItineraryItemControl({ slug, item, days }: { slug: string; item: Item; days: { id: string; label: string }[] }) {
  const [title, setTitle] = useState(item.title), [note, setNote] = useState(item.note || ""), [startTimeLocal, setStartTimeLocal] = useState(item.startTimeLocal || ""), [duration, setDuration] = useState(item.durationMinutes?.toString() || ""), [dayId, setDayId] = useState(item.dayId), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const endpoint = `/api/trips/${encodeURIComponent(slug)}/plan/items/${encodeURIComponent(item.id)}`;
  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, note: note || null, startTimeLocal: startTimeLocal || null, durationMinutes: duration ? Number(duration) : null, dayId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败");
      location.assign(`/trips/${encodeURIComponent(slug)}/plan?view=planning&day=${encodeURIComponent(dayId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); setSaving(false); }
  }
  async function remove() {
    if (!window.confirm("只删除这一条行程事项？")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败");
      location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败"); setSaving(false); }
  }
  return <details className="item-control"><summary>编辑 / 移动 / 删除</summary><div className="item-control-fields"><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>时间<input type="time" value={startTimeLocal} onChange={(event) => setStartTimeLocal(event.target.value)}/></label><label>时长（分钟）<input type="number" min="0" step="1" value={duration} onChange={(event) => setDuration(event.target.value)}/></label><label className="item-note">备注<textarea value={note} onChange={(event) => setNote(event.target.value)}/></label><div className="item-actions"><button type="button" onClick={save} disabled={saving}>{saving ? "处理中…" : dayId === item.dayId ? "保存当前事项" : "保存并移动"}</button><button className="danger" type="button" onClick={remove} disabled={saving}>删除这一条</button></div>{error && <small role="alert">{error}</small>}</div></details>;
}
