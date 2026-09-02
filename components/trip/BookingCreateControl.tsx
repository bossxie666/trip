/* eslint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus */
"use client";

import { useState } from "react";
import { GenericPlacePicker, type GenericPlaceChoice } from "./GenericPlacePicker";

type MemberOption = { id: string; displayName: string };

export function BookingCreateControl({ slug, kind, members, existingPlaces = [] }: { slug: string; kind: "hotel" | "transport"; members: MemberOption[]; existingPlaces?: GenericPlaceChoice[] }) {
  const [open, setOpen] = useState(false), [type, setType] = useState<"flight" | "train" | "other">("flight"), [status, setStatus] = useState<"tentative" | "confirmed">("tentative"), [title, setTitle] = useState(""), [place, setPlace] = useState<GenericPlaceChoice | null>(null), [origin, setOrigin] = useState<GenericPlaceChoice | null>(null), [destination, setDestination] = useState<GenericPlaceChoice | null>(null), [startDate, setStartDate] = useState(""), [endDate, setEndDate] = useState(""), [startTime, setStartTime] = useState(""), [endTime, setEndTime] = useState(""), [reference, setReference] = useState(""), [amount, setAmount] = useState(""), [notes, setNotes] = useState(""), [memberIds, setMemberIds] = useState(members.map((member) => member.id)), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const payloadPlace = (value: GenericPlaceChoice | null) => value ? (value.source === "existing" ? { placeId: value.id } : { providerPlaceId: value.providerPlaceId || value.id }) : null;
  const instant = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00+08:00`).toISOString() : null;
  async function save() {
    setSaving(true); setError("");
    try {
      if (kind === "hotel" && (!place || !startDate || !endDate)) throw new Error("请选择真实住宿地点和入离店日期。");
      if (kind === "transport" && (!startDate || (!origin && !destination))) throw new Error("请至少填写日期与一个真实起终点。");
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/bookings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: kind === "hotel" ? "hotel" : type, status, title: title.trim() || (kind === "hotel" ? place?.name : `${origin?.name || "起点待定"} → ${destination?.name || "终点待定"}`), startDateLocal: startDate, endDateLocal: kind === "hotel" ? endDate : (endDate || startDate), startAt: kind === "hotel" ? null : instant(startDate, startTime), endAt: kind === "hotel" ? null : instant(endDate || startDate, endTime), place: payloadPlace(place), origin: payloadPlace(origin), destination: payloadPlace(destination), totalAmountMinor: amount.trim() ? Math.round(Number(amount) * 100) : null, participantMemberIds: memberIds, bookingReference: reference.trim() || null, notes: notes.trim() || null }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败。");
      location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); setSaving(false); }
  }
  return <>
    <button type="button" className={kind === "hotel" ? "booking-add-button" : "add-itinerary-button"} onClick={() => setOpen(true)}>＋ {kind === "hotel" ? "添加住宿" : "添加长途交通"}</button>
    {open && <div className="plan-add-modal" role="dialog" aria-modal="true" aria-label={kind === "hotel" ? "添加住宿" : "添加长途交通"}><div className="plan-add-sheet"><header><div><span>{kind === "hotel" ? "ACCOMMODATION" : "TRANSPORT"}</span><h3>{kind === "hotel" ? "编辑住宿" : "添加长途交通"}</h3></div><button type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button></header>
      {kind === "hotel" ? <label>住哪里？<GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} autoFocus /></label> : <><label>交通方式<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="flight">飞机</option><option value="train">高铁 / 火车</option><option value="other">其他长途交通</option></select></label><label>起点（可暂空）<GenericPlacePicker slug={slug} existing={existingPlaces} value={origin} onChange={setOrigin} /></label><label>终点（可暂空）<GenericPlacePicker slug={slug} existing={existingPlaces} value={destination} onChange={setDestination} /></label></>}
      <div className="plan-add-two-columns"><label>{kind === "hotel" ? "入住日期" : "出发日期"}<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>{kind === "hotel" ? "退房日期" : "到达日期（可选）"}<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
      {kind === "transport" && <div className="plan-add-two-columns"><label>出发时间（可选）<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>到达时间（可选）<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div>}
      <label>显示名称（可选）<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "hotel" ? "默认使用真实酒店名" : "例如 Y87578"} /></label>
      {kind === "transport" && <label>班次 / 订单号（可选）<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>}
      <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="tentative">计划中 / 未预订</option><option value="confirmed">已预订 / 已购买</option></select></label>
      <label>总价（元，可选）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <fieldset className="plan-add-participants"><legend>{kind === "hotel" ? "入住成员" : "乘坐成员"}</legend><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={() => setMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}/><span>{member.displayName}</span></label>)}</div></fieldset>
      <label>备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="plan-add-submit" disabled={saving} onClick={save}>{saving ? "保存中…" : "保存"}</button></div></div>}
  </>;
}
