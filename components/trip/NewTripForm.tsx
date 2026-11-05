"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editorRequest } from "./editor-request";
import { useClientReady } from "./useClientReady";
import type { TripStatus } from "@/models/travel";

type MemberOption = { id: string; displayName: string };
export function NewTripForm({ members, currentMemberId }: { members: MemberOption[]; currentMemberId: string }) {
  const router = useRouter();
  const ready = useClientReady(), submitted = useRef(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TripStatus>("planning");
  const [undated, setUndated] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [memberIds, setMemberIds] = useState([currentMemberId]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || !ready) return;
    submitted.current = true;
    setError("");
    setSaving(true);
    let navigating = false;
    try {
      const payload = await editorRequest<{ trip?: { slug: string } }>("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, status, cities: [], undated, startDate, endDate, people: memberIds.length || 1, cover: null, memberIds }),
      });
      if (!payload.trip?.slug) throw new Error("保存结果尚未确认，请先到“我的旅行”查看，避免重复创建。");
      router.replace(`/trips/${payload.trip.slug}/plan`);
      navigating = true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "创建失败，请重试。";
      setError(/超时|网络异常/.test(message) ? "保存结果尚未确认，请先到“我的旅行”查看，避免重复创建。" : message);
    } finally {
      if (!navigating) { submitted.current = false; setSaving(false); }
    }
  }

  return (
    <form className="new-trip-form" aria-busy={saving} onSubmit={submit}>
      <label><span>行程名称 *</span><input required disabled={saving} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：日本关西" /></label>
      <fieldset disabled={saving}><legend>状态</legend><label><input type="radio" checked={status === "planning"} onChange={() => setStatus("planning")} />待出行</label><label><input type="radio" checked={status === "completed"} onChange={() => setStatus("completed")} />已出行</label><label><input type="radio" checked={status === "inspiration"} onChange={() => setStatus("inspiration")} />灵感</label></fieldset>
      <fieldset disabled={saving}><legend>日期</legend><label className="inline-check"><input type="checkbox" checked={undated} onChange={(event) => setUndated(event.target.checked)} />日期未定</label><div className="date-fields"><label><span>开始日期</span><input type="date" required={!undated} disabled={undated} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>结束日期</span><input type="date" required={!undated} disabled={undated} min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div></fieldset>
      <fieldset disabled={saving}><legend>参与成员</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={(event) => setMemberIds((current) => event.target.checked ? [...new Set([...current, member.id])] : current.filter((id) => id !== member.id))} />{member.displayName}</label>)}</fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="create-trip-button" type="submit" disabled={!ready || saving}>{saving ? "正在保存…" : "创建行程"}</button>
    </form>
  );
}
