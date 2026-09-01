"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Trip, TripStatus } from "@/models/travel";

type MemberOption = { id: string; displayName: string };
export function EditTripForm({ trip, members }: { trip: Trip; members: MemberOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(trip.title), [status, setStatus] = useState<TripStatus>(trip.status);
  const [cities, setCities] = useState(trip.cities.map((city) => city.name).join("、"));
  const [undated, setUndated] = useState(!trip.startDate || !trip.endDate), [startDate, setStartDate] = useState(trip.startDate || ""), [endDate, setEndDate] = useState(trip.endDate || "");
  const [people, setPeople] = useState(trip.people), [cover, setCover] = useState(trip.cover || "");
  const [memberIds, setMemberIds] = useState(trip.members?.map((member) => member.id) || []);
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(`/api/trips/${trip.slug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, status, cities: cities.split(/[、,，]/).map((item) => item.trim()).filter(Boolean), undated, startDate, endDate, people, cover, memberIds }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error || "保存失败。"); setSaving(false); return; }
    router.refresh(); setSaving(false);
  }
  return <form className="edit-trip-form" onSubmit={save}>
    <h2>编辑基础信息</h2>
    <label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
    <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as TripStatus)}><option value="inspiration">灵感</option><option value="planning">待出行</option><option value="completed">已出行</option></select></label>
    <label>城市（用顿号分隔）<input value={cities} onChange={(event) => setCities(event.target.value)} required /></label>
    <label className="inline-check"><input type="checkbox" checked={undated} onChange={(event) => setUndated(event.target.checked)} />日期未定</label>
    {!undated && <div className="date-fields"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div>}
    <label>人数<input type="number" min="1" value={people} onChange={(event) => setPeople(Math.max(1, Number(event.target.value) || 1))} /></label>
    <label>封面地址<input value={cover} onChange={(event) => setCover(event.target.value)} /></label>
    <fieldset><legend>参与成员</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={(event) => setMemberIds((current) => event.target.checked ? [...new Set([...current, member.id])] : current.filter((id) => id !== member.id))} />{member.displayName}</label>)}</fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="edit-actions"><button disabled={saving}>{saving ? "保存中…" : "保存修改"}</button></div>
  </form>;
}
