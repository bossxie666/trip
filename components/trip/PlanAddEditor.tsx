"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";
import { TransportIcon } from "./TransportIcon";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import type { PlanAddControlProps } from "./PlanAddControl";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then(module => module.GenericPlacePicker), { ssr: false });
type Kind = "place" | "transport";
type TransportKind = "flight" | "railway" | "ferry";
type TimeMode = "untimed" | "start_only" | "range";
const transportLabels: Record<TransportKind, string> = { flight: "飞机", railway: "铁路（高铁 / 动车 / 城际 / 火车）", ferry: "客轮 / 固定班次轮渡" };

export function PlanAddEditor({ slug, days, defaultDayId, currentMemberId, existingTransport = [], members = [], existingPlaces = [], onClose, onSaved }: PlanAddControlProps & { onClose: () => void; onSaved: (dayId: string) => void }) {
  const [kind, setKind] = useState<Kind>("place"), [dayId, setDayId] = useState(defaultDayId);
  const [place, setPlace] = useState<GenericPlaceChoice | null>(null), [title, setTitle] = useState(""), [note, setNote] = useState("");
  const [origin, setOrigin] = useState<GenericPlaceChoice | null>(null), [destination, setDestination] = useState<GenericPlaceChoice | null>(null);
  const [transportType, setTransportType] = useState<TransportKind>("flight"), [startDate, setStartDate] = useState(""), [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState(""), [endTime, setEndTime] = useState(""), [timeMode, setTimeMode] = useState<TimeMode>("untimed");
  const [reference, setReference] = useState(""), [bookingCode, setBookingCode] = useState(""), [provider, setProvider] = useState(""), [fare, setFare] = useState(""), [reuseId, setReuseId] = useState("");
  const [participantMemberIds, setParticipantMemberIds] = useState<string[]>(currentMemberId ? [currentMemberId] : []);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const tabId = useId(), placeTab = useRef<HTMLButtonElement>(null), transportTab = useRef<HTMLButtonElement>(null);
  const dirty = Boolean(place || title || note || origin || destination || startDate || endDate || startTime || endTime || reference || bookingCode || provider || fare || reuseId)
    || dayId !== defaultDayId || transportType !== "flight" || timeMode !== "untimed"
    || JSON.stringify([...participantMemberIds].sort()) !== JSON.stringify(currentMemberId ? [currentMemberId] : []);
  const targetDayLabel = days.find(day => day.id === dayId)?.label.split(/\s+/, 1)[0] || "当天";
  const placeBody = (value: GenericPlaceChoice | null) => value ? (value.source === "existing" ? { placeId: value.id } : { providerPlaceId: value.providerPlaceId || value.id }) : null;
  const instant = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00+08:00`).toISOString() : null;
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: Kind = event.key === "Home" ? "place" : event.key === "End" ? "transport" : kind === "place" ? "transport" : "place";
    setKind(next);
    (next === "place" ? placeTab : transportTab).current?.focus();
  }
  function reuseTransport(id: string) {
    setReuseId(id);
    const existing = existingTransport.find(item => item.id === id);
    setOrigin(existing?.origin ?? null); setDestination(existing?.destination ?? null);
    setTransportType(existing?.type === "train" ? "railway" : existing?.type === "other" ? "ferry" : "flight");
    setFare(existing?.totalAmountMinor == null ? "" : String(existing.totalAmountMinor / 100));
  }
  async function submit() {
    setSaving(true); setError("");
    try {
      if (!days.some(day => day.id === dayId)) throw new Error("请选择目标日期。");
      let endpoint: string, body: Record<string, unknown>;
      if (kind === "place") {
        if (!place && !title.trim()) throw new Error("请选择真实地点，或填写一个无地点普通活动。");
        endpoint = `/api/trips/${encodeURIComponent(slug)}/plan/items`;
        body = place ? { dayId, ...placeBody(place), itemType: "place", title: place.name, note: note.trim() || null } : { dayId, itemType: "activity", title: title.trim(), note: note.trim() || null };
      } else {
        if (!startDate) throw new Error("请填写交通日期。");
        if (!origin || !destination) throw new Error("请选择真实的出发地和到达地。");
        if (timeMode !== "untimed" && !startTime) throw new Error("请填写出发时间。");
        if (timeMode === "range" && !endTime) throw new Error("请填写到达时间。");
        const startAt = timeMode === "untimed" ? null : instant(startDate, startTime);
        const endAt = timeMode === "range" ? instant(endDate || startDate, endTime) : null;
        if (startAt && endAt && endAt < startAt) throw new Error("到达日期和时间不能早于出发。");
        const amountMinor = fare.trim() ? Math.round(Number(fare) * 100) : null;
        if (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor < 0)) throw new Error("请输入有效票价。");
        endpoint = `/api/trips/${encodeURIComponent(slug)}/bookings`;
        const type = transportType === "flight" ? "flight" : transportType === "railway" ? "train" : "other";
        const service = reference.trim(), route = `${origin.name} → ${destination.name}`;
        body = { type, status: "tentative", title: [service, route].filter(Boolean).join(" · "), provider: provider.trim() || null,
          startDateLocal: startDate, endDateLocal: timeMode === "range" ? endDate || startDate : startDate, startAt, endAt,
          origin: placeBody(origin), destination: placeBody(destination), originLabel: null, destinationLabel: null,
          bookingReference: bookingCode.trim() || null, totalAmountMinor: amountMinor, participantMemberIds,
          notes: [service ? `班次：${service}` : "", note.trim()].filter(Boolean).join("\n") || null };
      }
      await editorRequest(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      onSaved(dayId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败，请重试。"); }
    finally { setSaving(false); }
  }
  return <EditorDialog open title="添加行程" className="plan-add-editor" onClose={onClose} dirty={dirty} busy={saving} onSubmit={submit} submitLabel={`加入 ${targetDayLabel}`}>
    <label>目标日期<select value={dayId} onChange={event => setDayId(event.target.value)}>{days.map(day => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>
    <div className="plan-add-kind" role="tablist" aria-label="添加类型">
      <button ref={placeTab} id={`${tabId}-place`} type="button" role="tab" aria-selected={kind === "place"} aria-controls={`${tabId}-panel`} tabIndex={kind === "place" ? 0 : -1} className={kind === "place" ? "active" : ""} onKeyDown={tabKey} onClick={() => setKind("place")}><TransportIcon kind="attraction" size={16} />地点 / 活动</button>
      <button ref={transportTab} id={`${tabId}-transport`} type="button" role="tab" aria-selected={kind === "transport"} aria-controls={`${tabId}-panel`} tabIndex={kind === "transport" ? 0 : -1} className={kind === "transport" ? "active" : ""} onKeyDown={tabKey} onClick={() => setKind("transport")}><TransportIcon kind="train" size={16} />班次 / 票务交通</button>
    </div>
    <div className="plan-add-fields" id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${kind}`}>
      {kind === "place" ? <>
        <div className="plan-add-place-field"><span>真实地点</span><GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={value => { setPlace(value); if (value) setTitle(""); }} /></div>
        <label>无地点普通活动<input maxLength={120} value={title} onChange={event => { setTitle(event.target.value); if (event.target.value.trim()) setPlace(null); }} placeholder="活动名称" /></label>
      </> : <>
        {existingTransport.length > 0 && <label>已有个人交通（可复用）<select value={reuseId} onChange={event => reuseTransport(event.target.value)}><option value="">重新记录一条班次交通</option>{existingTransport.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}
        <label>交通方式<select value={transportType} onChange={event => setTransportType(event.target.value as TransportKind)}>{Object.entries(transportLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <div className="plan-add-two-columns"><fieldset><legend>出发地</legend><GenericPlacePicker slug={slug} existing={existingPlaces} value={origin} onChange={setOrigin} placeholder="搜索机场、车站或码头" /></fieldset><fieldset><legend>到达地</legend><GenericPlacePicker slug={slug} existing={existingPlaces} value={destination} onChange={setDestination} placeholder="搜索机场、车站或码头" /></fieldset></div>
        <label>时间模式<select value={timeMode} onChange={event => setTimeMode(event.target.value as TimeMode)}><option value="untimed">时间待定</option><option value="start_only">开始时间</option><option value="range">时间范围</option></select></label>
        <div className="plan-add-two-columns"><label>交通日期<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>{timeMode === "range" && <label>到达日期<input type="date" value={endDate || startDate} onChange={event => setEndDate(event.target.value)} /></label>}</div>
        {timeMode !== "untimed" && <div className="plan-add-two-columns"><label>出发时间<input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label>{timeMode === "range" && <label>到达时间<input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label>}</div>}
        <div className="plan-add-two-columns"><label>{transportType === "flight" ? "航班号" : transportType === "railway" ? "车次" : "班次号"}（可选）<input value={reference} onChange={event => setReference(event.target.value)} /></label><label>票价（元，可选）<input inputMode="decimal" value={fare} onChange={event => setFare(event.target.value)} /></label></div>
        {members.length > 0 && <fieldset className="plan-add-participants"><legend>乘坐成员</legend><div className="participant-checkboxes">{members.map(member => <label key={member.id}><input type="checkbox" checked={participantMemberIds.includes(member.id)} onChange={() => setParticipantMemberIds(current => current.includes(member.id) ? current.filter(id => id !== member.id) : [...current, member.id])} /><span>{member.displayName}</span></label>)}</div><button type="button" className="button-secondary" onClick={() => setParticipantMemberIds(members.map(member => member.id))}>全员乘坐</button></fieldset>}
        <div className="plan-add-two-columns"><label>运营方 / 航司（可选）<input value={provider} onChange={event => setProvider(event.target.value)} /></label><label>预订编号 / PNR（可选）<input value={bookingCode} onChange={event => setBookingCode(event.target.value)} /></label></div>
      </>}
      <label>备注（可选）<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </EditorDialog>;
}
