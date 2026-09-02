"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MemberOption = { id: string; displayName: string };
export function NewTripForm({ members, currentMemberId }: { members: MemberOption[]; currentMemberId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"inspiration" | "planning">("planning");
  const [undated, setUndated] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [memberIds, setMemberIds] = useState([currentMemberId]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, status, cities: [], undated, startDate, endDate, people: memberIds.length || 1, cover: null, memberIds }),
      });
      const payload = await response.json() as { trip?: { slug: string }; error?: string };
      if (!response.ok || !payload.trip) throw new Error(payload.error || "创建失败，请重试。");
      router.push(`/trips/${payload.trip.slug}/plan`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败，请重试。");
      setSaving(false);
    }
  }

  return (
    <form className="new-trip-form" onSubmit={submit}>
      <label><span>行程名称 *</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：日本关西" /></label>
      <fieldset><legend>状态</legend><label><input type="radio" checked={status === "planning"} onChange={() => setStatus("planning")} />待出行</label><label><input type="radio" checked={status === "inspiration"} onChange={() => setStatus("inspiration")} />灵感</label></fieldset>
      <fieldset><legend>日期</legend><label className="inline-check"><input type="checkbox" checked={undated} onChange={(event) => setUndated(event.target.checked)} />日期未定</label><div className="date-fields"><label><span>开始日期</span><input type="date" required={!undated} disabled={undated} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>结束日期</span><input type="date" required={!undated} disabled={undated} min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div></fieldset>
      <fieldset><legend>参与成员</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={(event) => setMemberIds((current) => event.target.checked ? [...new Set([...current, member.id])] : current.filter((id) => id !== member.id))} />{member.displayName}</label>)}</fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="create-trip-button" type="submit" disabled={saving}>{saving ? "正在保存…" : "创建行程"}</button>
    </form>
  );
}
