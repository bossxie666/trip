/* eslint-disable jsx-a11y/label-has-associated-control */
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { TransportIcon } from "./TransportIcon";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then((module) => module.GenericPlacePicker), { ssr: false });
const WorkspaceOverlay = dynamic(() => import("./WorkspaceOverlay").then((module) => module.WorkspaceOverlay), { ssr: false });

type DayOption = { id: string; label: string };
type MemberOption = { id: string; displayName: string };
type TransportKind = "flight" | "high_speed_rail" | "train" | "other";
type TimeMode = "untimed" | "start_only" | "range";
type ExistingTransport = { id: string; title: string; origin: string; destination: string; type: string; totalAmountMinor: number | null };

const transportLabels: Record<TransportKind, string> = { flight: "飞机", high_speed_rail: "高铁", train: "火车", other: "其他长途交通" };

export function PlanAddControl({ slug, days, defaultDayId, currentMemberId, existingTransport = [], members = [], existingPlaces = [] }: { slug: string; days: DayOption[]; defaultDayId: string; currentMemberId?: string | null; existingTransport?: ExistingTransport[]; members?: MemberOption[]; existingPlaces?: GenericPlaceChoice[] }) {
  const { openPlanningDay } = useWorkspaceNavigation();
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
      setOpen(false); reset(); openPlanningDay(slug, dayId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); setSaving(false); }
  }
  const targetDayLabel = days.find((day) => day.id === dayId)?.label.split(/\s+/, 1)[0] || "今天";
  const quickPlaces = existingPlaces.slice(0, 8);
  return <>
    <button type="button" className="add-itinerary-button button-primary" onClick={() => { setDayId(defaultDayId); requestTripModalOpen(modalOwner); setOpen(true); }}>＋ 添加行程</button>
    {open && <WorkspaceOverlay open={open} onClose={() => setOpen(false)} ariaLabel="添加行程" className="plan-add-sheet" mode="modal">
      <header><div><span>ADD TO DAY</span><h3>添加到 {targetDayLabel}</h3><p>想把什么加入今天？</p></div><button type="button" className="workspace-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button></header>
      <label className="plan-add-target-day"><span>目标日期</span><select value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label>
      <div className="plan-add-kind" role="tablist" aria-label="添加类型"><button type="button" role="tab" aria-selected={kind === "place"} className={kind === "place" ? "active" : ""} onClick={() => setKind("place")}><TransportIcon kind="attraction" size={14}/>地点</button><button type="button" role="tab" aria-selected={kind === "transport"} className={kind === "transport" ? "active" : ""} onClick={() => setKind("transport")}><TransportIcon kind="train" size={14}/>交通</button><button type="button" role="tab" aria-selected={kind === "note"} className={kind === "note" ? "active" : ""} onClick={() => setKind("note")}><TransportIcon kind="calendar" size={14}/>事项</button></div>
      {kind === "place" && <div className="plan-add-search"><section className="plan-add-quick-places"><div className="plan-add-section-heading"><b>当前可直接使用</b><small>已有地点、住宿与收藏</small></div>{quickPlaces.length > 0 ? <div className="plan-add-choice-list">{quickPlaces.map((choice) => <button type="button" className={`plan-add-choice-row ${place?.id === choice.id ? "selected" : ""}`} key={`${choice.source}-${choice.id}`} onClick={() => setPlace(choice)}><TransportIcon kind={choice.name.includes("酒店") || choice.name.includes("住宿") ? "hotel" : "attraction"} size={16}/><span><b>{choice.name}</b><small>{choice.cityName || choice.district || "已有地点"}{choice.address ? ` · ${choice.address}` : ""}</small></span><i aria-hidden="true">{place?.id === choice.id ? "✓" : ""}</i></button>)}</div> : <p className="plan-add-muted">还没有可直接使用的地点。</p>}</section><section className="plan-add-search-section"><div className="plan-add-section-heading"><b>搜索新的地点</b><small>选择真实 Place 后再加入 Day</small></div><GenericPlacePicker slug={slug} existing={[]} value={place && place.source === "amap" ? place : null} onChange={setPlace} showExisting={false} placeholder="搜索酒店、机场、车站、景点、餐厅……" /></section></div>}
      {kind === "transport" && <div className="plan-add-transport"><div className="plan-add-section-heading"><b>添加长途交通</b><small>交通会作为两个地点之间的路线 Edge</small></div>{existingTransport.length > 0 && <label>已有个人交通（可复用）<select value={reuseId} onChange={(event) => reuseTransport(event.target.value)}><option value="">重新记录一条长途交通</option>{existingTransport.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}<label>交通方式<select value={transportType} onChange={(event) => setTransportType(event.target.value as TransportKind)}>{Object.entries(transportLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="plan-add-two-columns"><label>起点文字（可填城市）<input value={originLabel} onChange={(event) => { setOriginLabel(event.target.value); if (origin) setOrigin(null); }} placeholder="深圳 / 深圳宝安国际机场" /></label><label>终点文字（可填城市）<input value={destinationLabel} onChange={(event) => { setDestinationLabel(event.target.value); if (destination) setDestination(null); }} placeholder="上海 / 上海浦东国际机场" /></label></div><div className="plan-add-two-columns"><label>起点具体地点（可选）<GenericPlacePicker slug={slug} existing={existingPlaces} value={origin} onChange={(value) => { setOrigin(value); if (value) setOriginLabel(value.name); }} placeholder="搜索起点具体地点" /></label><label>终点具体地点（可选）<GenericPlacePicker slug={slug} existing={existingPlaces} value={destination} onChange={(value) => { setDestination(value); if (value) setDestinationLabel(value.name); }} placeholder="搜索终点具体地点" /></label></div><label>交通日期<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>时间模式<select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TimeMode)}><option value="untimed">时间待定</option><option value="start_only">开始时间</option><option value="range">时间范围</option></select></label>{timeMode !== "untimed" && <label>开始时间<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>}{timeMode === "range" && <label>结束时间<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>}<label>{transportType === "flight" ? "航班号" : transportType === "other" ? "交通编号" : "车次"}（可选）<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={transportType === "flight" ? "例如 Y87578" : transportType === "other" ? "例如班次或订单号" : "例如 G7553"} /></label><label>票价（元，可选）<input inputMode="decimal" value={fare} onChange={(event) => setFare(event.target.value)} placeholder="待确认可留空" /></label></div>}
      {kind === "note" && <div className="plan-add-note"><div className="plan-add-section-heading"><b>添加无地点事项</b><small>适合自由活动、休息、提醒等内容</small></div><label>事项名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="集合、休息、取行李、自由活动…" /></label><label>时间模式<select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TimeMode)}><option value="untimed">时间待定</option><option value="start_only">开始时间</option><option value="range">时间范围</option></select></label>{timeMode !== "untimed" && <label>开始时间<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>}{timeMode === "range" && <label>结束时间<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>}<label>备注（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label></div>}
      {(kind === "transport" || kind === "note") && members.length > 0 && <fieldset className="plan-add-participants"><legend>参与成员</legend><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantMemberIds.includes(member.id)} onChange={() => setParticipantMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}/><span>{member.displayName}</span></label>)}</div><button type="button" className="button-secondary" onClick={() => setParticipantMemberIds(members.map((member) => member.id))}>全员参与</button></fieldset>}
      {kind === "transport" && <label>备注（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="行李、提前到站、检票提醒…" /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="workspace-footer"><button type="button" className="button-secondary plan-add-cancel" disabled={saving} onClick={() => setOpen(false)}>取消</button><button type="button" className="plan-add-submit button-primary" disabled={saving} onClick={() => void submit()}>{saving ? "保存中…" : `加入 ${targetDayLabel}`}</button></footer>
    </WorkspaceOverlay>}
  </>;
}
