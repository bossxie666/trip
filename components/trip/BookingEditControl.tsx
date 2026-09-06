/* eslint-disable jsx-a11y/label-has-associated-control */
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then((module) => module.GenericPlacePicker), { ssr: false });
const WorkspaceOverlay = dynamic(() => import("./WorkspaceOverlay").then((module) => module.WorkspaceOverlay), { ssr: false });

type Member = { id: string; displayName: string };
type Place = { id: string; name: string; address: string | null; district?: string | null; cityId?: string | null; latitude?: number | null; longitude?: number | null } | null;
type BookingRecord = { booking: { id: string; type: string; title: string; status: "tentative" | "confirmed" | "cancelled"; startDateLocal: string | null; endDateLocal: string | null; startAt: string | null; endAt: string | null; timezone?: string | null; totalAmountMinor: number | null; currency: string | null; bookingReference: string | null; notes: string | null; placeId: string | null; originPlaceId: string | null; destinationPlaceId: string | null; originLabel?: string | null; destinationLabel?: string | null }; place: Place; originPlace?: Place; destinationPlace?: Place; memberStates?: Record<string, string> };

const yuan = (minor: number | null | undefined) => minor == null ? "" : (minor / 100).toFixed(2).replace(/\.00$/, "");
const toMinor = (value: string) => { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 100) : NaN; };
const zonedTimeParts = (value: string | null, timezone: string | null | undefined) => {
  if (!value) return { date: "", time: "" };
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
    const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
  } catch {
    return { date: value.slice(0, 10), time: value.match(/T(\d{2}:\d{2})/)?.[1] || "" };
  }
};

function timezoneOffsetMs(instantMs: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instantMs;
}

function localDateTimeToUtc(date: string, time: string, timezone: string) {
  const localAsUtc = Date.parse(`${date}T${time}:00.000Z`);
  if (!Number.isFinite(localAsUtc)) return null;
  // Re-evaluate the offset after the first conversion so DST transitions are
  // handled without hard-coding a +08:00 offset into the editor.
  const first = localAsUtc - timezoneOffsetMs(localAsUtc, timezone);
  const corrected = localAsUtc - timezoneOffsetMs(first, timezone);
  return new Date(corrected).toISOString();
}

export function BookingEditControl({ slug, booking: record, members, existingPlaces = [], placeUsageCount = 0 }: { slug: string; booking: BookingRecord; members: Member[]; existingPlaces?: GenericPlaceChoice[]; placeUsageCount?: number }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const booking = record.booking;
  const modalName = `booking-editor:${booking.id}`;
  const timezone = booking.timezone || "Asia/Shanghai";
  const startParts = zonedTimeParts(booking.startAt, timezone), endParts = zonedTimeParts(booking.endAt, timezone);
  const [open, setOpen] = useState(false), [title, setTitle] = useState(booking.title), [status, setStatus] = useState(booking.status), [place, setPlace] = useState<GenericPlaceChoice | null>(record.place ? { id: record.place.id, name: record.place.name, address: record.place.address, district: record.place.district, source: "existing" } : null), [originLabel, setOriginLabel] = useState(booking.originLabel || record.originPlace?.name || ""), [destinationLabel, setDestinationLabel] = useState(booking.destinationLabel || record.destinationPlace?.name || ""), [origin, setOrigin] = useState<GenericPlaceChoice | null>(record.originPlace ? { id: record.originPlace.id, name: record.originPlace.name, address: record.originPlace.address, district: record.originPlace.district, source: "existing" } : null), [destination, setDestination] = useState<GenericPlaceChoice | null>(record.destinationPlace ? { id: record.destinationPlace.id, name: record.destinationPlace.name, address: record.destinationPlace.address, district: record.destinationPlace.district, source: "existing" } : null), [startDate, setStartDate] = useState(booking.startDateLocal || startParts.date), [endDate, setEndDate] = useState(booking.endDateLocal || endParts.date), [startTime, setStartTime] = useState(startParts.time), [endTime, setEndTime] = useState(endParts.time), [amount, setAmount] = useState(yuan(booking.totalAmountMinor)), [reference, setReference] = useState(booking.bookingReference || ""), [participantIds, setParticipantIds] = useState(() => members.filter((member) => record.memberStates?.[member.id] === "present").map((member) => member.id)), [notes, setNotes] = useState(booking.notes || ""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  useExclusiveTripModal(modalName, () => setOpen(false));
  const openEditor = () => { setSaving(false); setError(""); requestTripModalOpen(modalName); setOpen(true); };
  const closeEditor = () => { if (!saving) setOpen(false); };
  const placeBody = (value: GenericPlaceChoice | null) => value ? (value.source === "existing" ? { placeId: value.id } : { providerPlaceId: value.providerPlaceId || value.id }) : null;
  const instant = (date: string, time: string) => date && time ? localDateTimeToUtc(date, time, timezone) : null;
  async function save() {
    setSaving(true); setError("");
    try {
      const amountMinor = amount.trim() ? toMinor(amount) : null;
      if (amount.trim() && (amountMinor == null || !Number.isSafeInteger(amountMinor) || amountMinor < 0)) throw new Error("请输入有效金额。");
      const body: Record<string, unknown> = { title, status, startDateLocal: startDate || null, endDateLocal: endDate || null, startAt: instant(startDate, startTime), endAt: instant(endDate || startDate, endTime), totalAmountMinor: amountMinor, currency: amountMinor == null ? null : "CNY", participantMemberIds: participantIds, bookingReference: reference.trim() || null, notes: notes.trim() || null };
      if (booking.type === "hotel") body.place = placeBody(place);
      else { body.origin = placeBody(origin); body.destination = placeBody(destination); body.originLabel = originLabel.trim() || null; body.destinationLabel = destinationLabel.trim() || null; }
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(booking.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败。");
      setSaving(false); setOpen(false);
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); setSaving(false); }
  }
  async function remove() {
    const warning = placeUsageCount > 0 ? `\n行程中仍有 ${placeUsageCount} 个事项使用该地点，它们不会被删除。` : "";
    if (!window.confirm(`确定删除这条${booking.type === "hotel" ? "住宿" : "交通"}吗？\n${booking.title}${warning}`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(booking.id)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败。");
      setSaving(false); setOpen(false);
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败。"); setSaving(false); }
  }
  const headingId = `booking-edit-title-${booking.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return <>
    <div className="booking-edit-control"><button type="button" className="booking-edit-trigger button-ghost" onClick={openEditor}>{booking.type === "hotel" ? "编辑住宿" : "编辑交通"}</button></div>
    {open && <WorkspaceOverlay open={open} onClose={closeEditor} mode="drawer" ariaLabel={booking.type === "hotel" ? "编辑住宿" : "编辑交通"} ariaLabelledBy={headingId} className="booking-edit-dialog">
        <header><div><span>BOOKING</span><h2 id={headingId}>{booking.type === "hotel" ? "编辑住宿" : "编辑交通"}</h2><p>{booking.title}</p></div><button type="button" className="workspace-close booking-edit-close" aria-label="关闭编辑器" onClick={closeEditor}>×</button></header>
        <div className="booking-edit-sheet">
          <label>显示名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          {booking.type === "hotel" ? <label>准确地点<GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} /></label> : <>
            <div className="plan-add-two-columns"><label>起点文字<input value={originLabel} onChange={(event) => setOriginLabel(event.target.value)} /></label><label>终点文字<input value={destinationLabel} onChange={(event) => setDestinationLabel(event.target.value)} /></label></div>
            <div className="plan-add-two-columns"><label>起点具体地点<GenericPlacePicker slug={slug} existing={existingPlaces} value={origin} onChange={(value) => { setOrigin(value); if (value) setOriginLabel(value.name); }} /></label><label>终点具体地点<GenericPlacePicker slug={slug} existing={existingPlaces} value={destination} onChange={(value) => { setDestination(value); if (value) setDestinationLabel(value.name); }} /></label></div>
          </>}
          <div className="plan-add-two-columns"><label>{booking.type === "hotel" ? "入住日期" : "开始日期"}<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>{booking.type === "hotel" ? "退房日期" : "结束日期"}<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
          <div className="plan-add-two-columns"><label>开始时间（可选）<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>结束时间（可选）<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div>
          {booking.type !== "hotel" && <label>{booking.type === "flight" ? "航班号" : booking.type === "train" ? "车次" : "交通编号（可选）"}<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>}
          <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="tentative">计划中</option><option value="confirmed">已订</option><option value="cancelled">已取消</option></select></label>
          <label>总价（元）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <fieldset className="plan-add-participants"><legend>{booking.type === "hotel" ? "入住成员" : "乘坐成员"}</legend><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => setParticipantIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}/><span>{member.displayName}</span></label>)}</div></fieldset>
          <label>备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="booking-danger-zone"><span>DANGER ZONE</span><button type="button" className="button-danger booking-danger" disabled={saving} onClick={() => void remove()}>删除{booking.type === "hotel" ? "住宿" : "交通"}</button></div>
          <footer className="workspace-footer"><button type="button" className="button-secondary booking-edit-cancel" disabled={saving} onClick={closeEditor}>取消</button><button type="button" className="button-primary plan-add-submit" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : `保存${booking.type === "hotel" ? "住宿" : "交通"}`}</button></footer>
        </div>
    </WorkspaceOverlay>}
  </>;
}
