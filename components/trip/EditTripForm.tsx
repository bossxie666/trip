"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { Trip, TripStatus } from "@/models/travel";

type MemberOption = { id: string; displayName: string };
type EditableTrip = Pick<Trip, "slug" | "title" | "status" | "startDate" | "endDate" | "cover"> & { cities: { name: string }[]; members?: { id: string }[] };
export function EditTripForm({ trip, members, onSaved }: { trip: EditableTrip; members: MemberOption[]; onSaved?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(trip.title), [status, setStatus] = useState<TripStatus>(trip.status);
  const [undated, setUndated] = useState(!trip.startDate || !trip.endDate), [startDate, setStartDate] = useState(trip.startDate || ""), [endDate, setEndDate] = useState(trip.endDate || "");
  const [memberIds, setMemberIds] = useState(trip.members?.map((member) => member.id) || []);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const cover = coverFile ? `/api/media/${encodeURIComponent(await uploadMediaFile(coverFile, "trip_cover"))}?variant=display` : trip.cover;
      const response = await fetch(`/api/trips/${trip.slug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, status, cities: trip.cities.map((city) => city.name), undated, startDate, endDate, people: memberIds.length || 1, cover, memberIds }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败。");
      router.refresh(); onSaved?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); }
    finally { setSaving(false); }
  }
  return <form className="edit-trip-form" onSubmit={save}>
    <label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
    <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as TripStatus)}><option value="inspiration">灵感</option><option value="planning">待出行</option><option value="completed">已出行</option></select></label>
    <label className="inline-check"><input type="checkbox" checked={undated} onChange={(event) => setUndated(event.target.checked)} />日期未定</label>
    {!undated && <div className="date-fields"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div>}
    <label className="trip-cover-upload">行程封面<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} /><small>{coverFile ? `已选择：${coverFile.name}` : "成员可替换拍立得封面，单张不超过 10MB。"}</small></label>
    <fieldset><legend>参与成员</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={(event) => setMemberIds((current) => event.target.checked ? [...new Set([...current, member.id])] : current.filter((id) => id !== member.id))} />{member.displayName}</label>)}</fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="edit-actions"><button disabled={saving}>{saving ? "保存中…" : "保存修改"}</button></div>
  </form>;
}
