"use client";
import { useRef, useState } from "react";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

type PresenceState = "present" | "absent" | "partial" | "unknown";
type Member = { id: string; displayName: string };
type TimeMode = "untimed" | "start_only" | "range" | "all_day" | "opening_hours";
type Item = { id: string; title: string; note: string | null; startTimeLocal: string | null; endTimeLocal?: string | null; timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours"; openingHoursNote?: string | null; durationMinutes: number | null; dayId: string; itemType?: string };

export function ItineraryItemControl({ slug, item, days, members = [], participantStates = {}, participantOverrides = {}, dayPresenceState = {}, allowOpeningHours = true }: { slug: string; item: Item; days: { id: string; label: string }[]; members?: Member[]; participantStates?: Record<string, PresenceState>; participantOverrides?: Record<string, "included" | "excluded">; dayPresenceState?: Record<string, PresenceState>; allowOpeningHours?: boolean }) {
  const { openPlanningDay, refreshWorkspace } = useWorkspaceNavigation();
  const initialMode: TimeMode = item.timeMode === "all_day" ? "all_day" : item.timeMode === "opening_hours" && allowOpeningHours ? "opening_hours" : item.timeMode === "range" ? "range" : item.timeMode === "start_only" || item.startTimeLocal ? "start_only" : "untimed";
  const [title, setTitle] = useState(item.title), [note, setNote] = useState(item.note || ""), [startTimeLocal, setStartTimeLocal] = useState(item.startTimeLocal || ""), [endTimeLocal, setEndTimeLocal] = useState(item.endTimeLocal || ""), [timeMode, setTimeMode] = useState<TimeMode>(initialMode), [openingHoursNote, setOpeningHoursNote] = useState(item.openingHoursNote || ""), [duration, setDuration] = useState(item.durationMinutes?.toString() || ""), [dayId, setDayId] = useState(item.dayId), [saving, setSaving] = useState(false), [error, setError] = useState(""), [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => members.filter((member) => participantOverrides[member.id] === "included" || (!participantOverrides[member.id] && participantStates[member.id] === "present")).map((member) => member.id)), [participantMode, setParticipantMode] = useState<"inherit" | "explicit">(() => Object.keys(participantOverrides).length ? "explicit" : "inherit"), [participantDirty, setParticipantDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const submitting = useRef(false);
  const initialMembers = members.filter(member => participantOverrides[member.id] === "included" || (!participantOverrides[member.id] && participantStates[member.id] === "present")).map(member => member.id);
  const initialParticipantMode = Object.keys(participantOverrides).length ? "explicit" : "inherit";
  const dirty = title !== item.title || note !== (item.note || "") || startTimeLocal !== (item.startTimeLocal || "") || endTimeLocal !== (item.endTimeLocal || "") || timeMode !== initialMode || openingHoursNote !== (item.openingHoursNote || "") || duration !== (item.durationMinutes?.toString() || "") || dayId !== item.dayId || (participantDirty && (participantMode !== initialParticipantMode || (participantMode === "explicit" && JSON.stringify([...selectedMemberIds].sort()) !== JSON.stringify([...initialMembers].sort()))));
  function show() {
    setTitle(item.title); setNote(item.note || ""); setStartTimeLocal(item.startTimeLocal || ""); setEndTimeLocal(item.endTimeLocal || "");
    setTimeMode(initialMode); setOpeningHoursNote(item.openingHoursNote || ""); setDuration(item.durationMinutes?.toString() || ""); setDayId(item.dayId);
    setSelectedMemberIds(initialMembers); setParticipantMode(initialParticipantMode); setParticipantDirty(false); setError(""); setOpen(true);
  }
  const endpoint = `/api/trips/${encodeURIComponent(slug)}/plan/items/${encodeURIComponent(item.id)}`;
  function setExplicit(next: string[]) { setSelectedMemberIds(next); setParticipantMode("explicit"); setParticipantDirty(true); }
  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true); setError("");
    try {
      await editorRequest(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, note: note || null, startTimeLocal: startTimeLocal || null, endTimeLocal: endTimeLocal || null, timeMode, openingHoursNote: timeMode === "opening_hours" ? (openingHoursNote || null) : null, durationMinutes: duration ? Number(duration) : null, dayId, ...(participantDirty ? { participantMemberIds: participantMode === "inherit" ? null : selectedMemberIds } : {}) }) });
      setOpen(false);
      if (dayId === item.dayId) refreshWorkspace(); else openPlanningDay(slug, dayId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); }
    finally { submitting.current = false; setSaving(false); }
  }
  async function remove() {
    if (submitting.current || !window.confirm("只删除这一条行程事项？")) return;
    submitting.current = true;
    setSaving(true); setError("");
    try {
      await editorRequest(endpoint, { method: "DELETE" });
      setOpen(false);
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败"); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <><button type="button" className="inline-edit-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={show}>编辑事项</button><EditorDialog open={open} title="编辑事项" onClose={() => setOpen(false)} dirty={dirty} busy={saving} onSubmit={save} submitLabel={dayId === item.dayId ? "保存当前事项" : "保存并移动"} actions={<button className="danger" type="button" onClick={remove} disabled={saving}>删除这一条</button>}><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>时间模式<select value={timeMode} onChange={(event) => setTimeMode(event.target.value as TimeMode)}><option value="untimed">时间待定</option><option value="all_day">全天</option><option value="start_only">开始时间</option><option value="range">时间范围</option>{allowOpeningHours ? <option value="opening_hours">营业时间</option> : null}</select></label>{timeMode === "start_only" || timeMode === "range" ? <label>开始时间<input type="time" value={startTimeLocal} onChange={(event) => setStartTimeLocal(event.target.value)}/></label> : null}{timeMode === "range" ? <label>结束时间<input type="time" value={endTimeLocal} onChange={(event) => setEndTimeLocal(event.target.value)}/></label> : null}{timeMode === "opening_hours" ? <label>营业时间说明<input value={openingHoursNote} onChange={(event) => setOpeningHoursNote(event.target.value)} placeholder="例如 07:30–17:00" /></label> : null}<label>时长（分钟）<input type="number" min="0" step="1" value={duration} onChange={(event) => setDuration(event.target.value)}/></label><label className="item-note">备注<textarea value={note} onChange={(event) => setNote(event.target.value)}/></label>{members.length > 0 && <fieldset className="item-participant-control"><legend>参与成员</legend><p>{participantMode === "inherit" ? "当前继承当天已确认成员；可在这里单独覆盖。" : `已指定 ${selectedMemberIds.length} 人参加这一条事项。`}</p><div className="participant-checkboxes">{members.map((member) => <label key={member.id}><input type="checkbox" checked={selectedMemberIds.includes(member.id)} onChange={() => setExplicit(selectedMemberIds.includes(member.id) ? selectedMemberIds.filter((id) => id !== member.id) : [...selectedMemberIds, member.id])}/><span>{member.displayName}</span></label>)}</div><div className="participant-shortcuts"><button type="button" onClick={() => setExplicit(members.map((member) => member.id))}>全员参与</button><button type="button" onClick={() => setExplicit(members.filter((member) => dayPresenceState[member.id] === "present").map((member) => member.id))}>按当天成员</button><button type="button" onClick={() => { setParticipantMode("inherit"); setParticipantDirty(true); }}>清除覆盖</button></div></fieldset>}{error && <small role="alert">{error}</small>}</EditorDialog></>;
}
