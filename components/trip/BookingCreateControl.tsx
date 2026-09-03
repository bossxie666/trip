/* eslint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus */
"use client";

import { useState } from "react";
import { GenericPlacePicker, type GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";

type MemberOption = { id: string; displayName: string };

/** Accommodation creation only; long-distance transport has one entry in PlanAddControl. */
export function BookingCreateControl({ slug, members, existingPlaces = [] }: { slug: string; members: MemberOption[]; existingPlaces?: GenericPlaceChoice[] }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"tentative" | "confirmed">("tentative");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState<GenericPlaceChoice | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [memberIds, setMemberIds] = useState(members.map((member) => member.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalOwner = `accommodation-create:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));

  const payloadPlace = (value: GenericPlaceChoice) => value.source === "existing"
    ? { placeId: value.id }
    : { providerPlaceId: value.providerPlaceId || value.id };
  const instant = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00+08:00`).toISOString() : null;

  async function save() {
    setSaving(true); setError("");
    try {
      if (!place || !startDate || !endDate) throw new Error("请选择真实住宿地点和入离店日期。");
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "hotel",
          status,
          title: title.trim() || place.name,
          startDateLocal: startDate,
          endDateLocal: endDate,
          startAt: instant(startDate, startTime),
          endAt: null,
          place: payloadPlace(place),
          totalAmountMinor: amount.trim() ? Math.round(Number(amount) * 100) : null,
          participantMemberIds: memberIds,
          notes: notes.trim() || null,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败。");
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败。");
      setSaving(false);
    }
  }

  return <>
    <button type="button" className="booking-add-button" onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>＋ 添加住宿</button>
    {open && <div className="plan-add-modal" role="dialog" aria-modal="true" aria-label="添加住宿"><div className="plan-add-sheet">
      <header><div><span>ACCOMMODATION</span><h3>编辑住宿</h3></div><button type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button></header>
      <label>住哪里？<GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} autoFocus /></label>
      <div className="plan-add-two-columns"><label>入住日期<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>退房日期<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
      <label>入住时间（可选）<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
      <label>显示名称（可选）<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="默认使用真实酒店名" /></label>
      <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="tentative">计划中 / 未预订</option><option value="confirmed">已预订</option></select></label>
      <label>总价（元，可选）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <fieldset className="plan-add-participants"><legend>入住成员</legend><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={() => setMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}/><span>{member.displayName}</span></label>)}</div></fieldset>
      <label>备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="plan-add-submit" disabled={saving} onClick={save}>{saving ? "保存中…" : "保存住宿"}</button>
    </div></div>}
  </>;
}
