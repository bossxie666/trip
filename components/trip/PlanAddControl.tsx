/* eslint-disable jsx-a11y/label-has-associated-control */
"use client";

import { useState } from "react";
import { GenericPlacePicker, type GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { TransportIcon } from "./TransportIcon";

type DayOption = { id: string; label: string };
type MemberOption = { id: string; displayName: string };
type TransportKind = "flight" | "high_speed_rail" | "train" | "other";
type TimeMode = "untimed" | "start_only" | "range";
type ExistingTransport = { id: string; title: string; origin: string; destination: string; type: string; totalAmountMinor: number | null };

const transportLabels: Record<TransportKind, string> = { flight: "飞机", high_speed_rail: "高铁", train: "火车", other: "其他长途交通" };

export function PlanAddControl({ slug, days, defaultDayId, currentMemberId, existingTransport = [], members = [], existingPlaces = [] }: { slug: string; days: DayOption[]; defaultDayId: string; currentMemberId?: string | null; existingTransport?: ExistingTransport[]; members?: MemberOption[]; existingPlaces?: GenericPlaceChoice[] }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState<"place" | "transport" | "note">("place"), [dayId, setDayId] = useState(defaultDayId);
  const [place, setPlace] = useState<GenericPlaceChoice | null>(null), [title, setTitle] = useState(""), [note, setNote] = useState("");
  const [origin, setOrigin] = useState<GenericPlaceChoice | null>(null), [destination, setDestination] = useState<GenericPlaceChoice | null>(null), [originLabel, setOriginLabel] = useState(""), [destinationLabel, setDestinationLabel] = useState("");
  const [transportType, setTransportType] = useState<TransportKind>("flight"), [startDate, setStartDate] = useState(""), [endDate, setEndDate] = useState(""), [startTime, setStartTime] = useState(""), [endTime, setEndTime] = useState(""), [reference, setReference] = useState(""), [fare, setFare] = useState(""), [timeMode, setTimeMode] = useState<TimeMode>("untimed"), [participantMemberIds, setParticipantMemberIds] = useState<string[]>(currentMemberId ? [currentMemberId] : []), [reuseId, setReuseId] = useState("");
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const modalOwner = `plan-add:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));

  function reset() { setPlace(null); setTitle(""); setNote(""); setOrigin(null); setDestination(null); setOriginLabel(""); setDestinationLabel(""); setStartDate(""); setEndDate(""); setStartTime(""); setEndTime(""); setReference(""); setFare(""); setTimeMode("untimed"); setReuseId(""); setParticipantMemberIds(currentMemberId ? [currentMemberId] : []); setError(""); }
  function reuseTransport(id: string) { setReuseId(id); const existing = existingTransport.find((item) => item.id === id); if (!existing) return; setOriginLabel(existing.origin); setDestinationLabel(existing.destination); setTransportType(existing.type === "flight" ? "flight" : existing.type === "train" ? "high_speed_rail" : "other"); setFare(existing.totalAmountMinor == null ? "" : String(existing.totalAmountMinor / 100)); }
  const placeBody = (value: GenericPlaceChoice | null) => value ? (value.source === "existing" ? { placeId: value.id } : { providerPlaceId: value.providerPlaceId || value.id }) : null;
  const instant = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00+08:00`).toISOString() : null;
  async function submit() {
    setSaving(true); setError("");
    try {
      let endpoint: string, body: Record<string, unknown>;
      if (kind === "place") {
        if (!place) throw new Error("请先选择一个真实地点。");
        endpoint = `/api/trips/${encodeURIComponent(slug)}/plan/items`;
        body = { dayId, ...placeBody(place), itemType: "place", title: place.name };
      } else if (kind === "note") {
        if (!title.trim()) throw new Error("请填写事项名称。");
        endpoint = `/api/trips/${encodeURIComponent(slug)}/plan/items`;
        body = { dayId, title: title.trim(), note: note.trim() || null, itemType: "note", startTimeLocal: timeMode === "untimed" ? null : startTime || null, endTimeLocal: timeMode === "range" ? endTime || null : null, timeMode, participantMemberIds };
      } else {
        if (!startDate) throw new Error("请填写交通日期。");
        if (!originLabel.trim() && !destinationLabel.trim() && !origin && !destination) throw new Error("请至少填写起点或终点。");
        endpoint = `/api/trips/${encodeURIComponent(slug)}/bookings`;
        const type = transportType === "flight" ? "flight" : transportType === "other" ? "other" : "train";
        body = { type, status: "tentative", title: title.trim() || `${originLabel.trim() || "起点待定"} → ${destinationLabel.trim() || "终点待定"}`, startDateLocal: startDate, endDateLocal: endDate || startDate, startAt: timeMode === "untimed" ? null : instant(startDate, startTime), endAt: timeMode === "range" ? instant(endDate || startDate, endTime) : null, origin: placeBody(origin), destination: placeBody(destination), originLabel: originLabel.trim() || origin?.name || null, destinationLabel: destinationLabel.trim() || destination?.name || null, bookingReference: reference.trim() || null, totalAmountMinor: fare.trim() ? Math.round(Number(fare) * 100) : null, participantMemberIds, notes: note.trim() || null };
      }
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败。");
      setOpen(false); reset(); location.assign(`/trips/${encodeURIComponent(slug)}/plan?view=planning&day=${encodeURIComponent(dayId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); setSaving(false); }
  }
  return <>
    <button type="button" className="add-itinerary-button" onClick={() => { setDayId(defaultDayId); requestTripModalOpen(modalOwner); setOpen(true); }}>＋ 添加行程</button>
    {open && <div className="plan-add-modal" role="dialog" aria-modal="true" aria-label="添加行程"><div className="plan-add-sheet"><header><div><span>ADD TO DAY</span><h3>把什么放进行程？</h3></div><button type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button></header>
      <label>目标日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>
      <div className="plan-add-kind"><button type="button" className={kind === "place" ? "active" : ""} onClick={() => setKind("place")}><TransportIcon kind="attraction" size={14}/>搜索地点</button><button type="button" className={kind === "transport" ? "active" : ""} onClick={() => setKind("transport")}><TransportIcon kind="train" size={14}/>交通行程</button><button type="button" className={kind === "note" ? "active" : ""} onClick={() => setKind("note")}><TransportIcon kind="calendar" size={14}/>普通事项</button></div>
      {kind === "place" && <div className="plan-add-search"><label>地点<GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} /></label></div>}
      {kind === "transport" && <div className="plan-add-transport">{existingTransport.length > 0 && <label>复用已有个人交通（可选）<select value={reuseId} onChange={(event) => reuseTransport(event.target.value)}><option value="">新建交通行程</option>{existingTransport.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}<label>交通方式<select value={transportType} onChange={(event) => setTransportType(event.target.value as TransportKind)}>{Object.entries(transportLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="plan-add-two-columns"><label>起点文字（可填城市）<input value={originLabel} onChange={(event) => { setOriginLabel(event.target.value); if (origin) setOrigin(null); }} placeholder="深圳 / 深圳宝安国际机场" /></label><label>终点文字（可填城市）<input value={destinationLabel} onChange={(event) => { setDestinationLabel(event.target.value); if (destination) setDestination(null); }} placeholder="上海 / 上海浦东国际机场" /></label></div><div className="plan-add-two-columns"><label>起点具体地点（可选）<GenericPlacePicker slug={slug} existing={existingPlaces} value={origin} onChange={(value) => { setOrigin(value); if (value) setOriginLabel(value.name); }} /></label><label>终点具体地点（可选）<GenericPlacePicker slug={slug} existing={existingPlaces} value={destination} onChange={(value) => { setDestination(value); if (value) setDestinationLabel(value.name); }} /></label></div><label>交通日期<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>时间模式<select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TimeMode)}><option value="untimed">时间待定</option><option value="start_only">开始时间</option><option value="range">时间范围</option></select></label>{timeMode !== "untimed" && <label>开始时间<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>}{timeMode === "range" && <label>结束时间<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>}<label>{transportType === "flight" ? "航班号" : transportType === "other" ? "交通编号" : "车次"}（可选）<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={transportType === "flight" ? "例如 Y87578" : transportType === "other" ? "例如班次或订单号" : "例如 G7553"} /></label><label>票价（元，可选）<input inputMode="decimal" value={fare} onChange={(event) => setFare(event.target.value)} placeholder="待确认可留空" /></label></div>}
      {kind === "note" && <div className="plan-add-note"><label>事项名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="集合、休息、取行李、自由活动…" /></label><label>时间模式<select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TimeMode)}><option value="untimed">时间待定</option><option value="start_only">开始时间</option><option value="range">时间范围</option></select></label>{timeMode !== "untimed" && <label>开始时间<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>}{timeMode === "range" && <label>结束时间<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>}<label>备注（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label></div>}
      {(kind === "transport" || kind === "note") && members.length > 0 && <fieldset className="plan-add-participants"><legend>参与成员</legend><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantMemberIds.includes(member.id)} onChange={() => setParticipantMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}/><span>{member.displayName}</span></label>)}</div><button type="button" onClick={() => setParticipantMemberIds(members.map((member) => member.id))}>全员参与</button></fieldset>}
      {kind === "transport" && <label>备注（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="行李、提前到站、检票提醒…" /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="plan-add-submit" disabled={saving} onClick={() => void submit()}>{saving ? "保存中…" : "加入这一天"}</button>
    </div></div>}
  </>;
}
