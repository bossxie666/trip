/* eslint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus */
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then((module) => module.GenericPlacePicker), { ssr: false });

type MemberOption = { id: string; displayName: string };

/** Accommodation creation only; long-distance transport has one entry in PlanAddControl. */
export function BookingCreateControl({ slug, members, existingPlaces = [] }: { slug: string; members: MemberOption[]; existingPlaces?: GenericPlaceChoice[] }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"tentative" | "confirmed">("tentative");
  const [place, setPlace] = useState<GenericPlaceChoice | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [memberIds, setMemberIds] = useState(members.map((member) => member.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalOwner = `accommodation-create:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  const dirty = status !== "tentative" || !!place || !!startDate || !!endDate || !!amount || !!notes
    || memberIds.length !== members.length || members.some(member => !memberIds.includes(member.id));
  function start() {
    setStatus("tentative"); setPlace(null); setStartDate(""); setEndDate(""); setAmount(""); setNotes("");
    setMemberIds(members.map(member => member.id)); setError(""); requestTripModalOpen(modalOwner); setOpen(true);
  }

  const payloadPlace = (value: GenericPlaceChoice) => value.source === "existing"
    ? { placeId: value.id }
    : { providerPlaceId: value.providerPlaceId || value.id };

  async function save() {
    setSaving(true); setError("");
    try {
      if (!place || !startDate || !endDate) throw new Error("请选择真实住宿地点和入离店日期。");
      const amountMinor = amount.trim() ? Math.round(Number(amount) * 100) : null;
      if (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor < 0)) throw new Error("请输入有效金额。");
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "hotel",
          status,
          title: place.name,
          startDateLocal: startDate,
          endDateLocal: endDate,
          startAt: null,
          endAt: null,
          place: payloadPlace(place),
          totalAmountMinor: amountMinor,
          participantMemberIds: memberIds,
          notes: notes.trim() || null,
        }),
      });
      setOpen(false);
      refreshWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败。");
    } finally { setSaving(false); }
  }

  return <>
    <button type="button" className="booking-add-button button-primary" onClick={start}>＋ 添加住宿</button>
    {open && <EditorDialog open title="添加住宿" className="accommodation-create-dialog" dirty={dirty} busy={saving} onClose={() => setOpen(false)} onSubmit={save} submitLabel="保存住宿">
      <label>住哪里？<GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} autoFocus /></label>
      <div className="plan-add-two-columns accommodation-date-fields"><label>入住日期<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>退房日期<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
      <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="tentative">计划中 / 未预订</option><option value="confirmed">已预订</option></select></label>
      <label>总价（元，可选）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <fieldset className="plan-add-participants"><legend>入住成员</legend><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={() => setMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}/><span>{member.displayName}</span></label>)}</div></fieldset>
      <label>备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
    </EditorDialog>}
  </>;
}
