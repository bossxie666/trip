"use client";
import { useId, useState } from "react";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";
import { presenceLocalTime } from "@/services/presence-time";
import type { PresenceContext, PresenceState } from "./DayPresenceControl";

type Draft = { state: Exclude<PresenceState, "unknown"> | null; startsAt: string; endsAt: string };
export function DayPresenceEditor({ context: incomingContext, onClose, onSaved }: { context: PresenceContext; onClose: () => void; onSaved: (states: PresenceContext["states"], details: PresenceContext["details"]) => void }) {
  // A background workspace refresh must not change an open editor's baseline.
  const [context] = useState(incomingContext);
  const { slug, dayId, dayLabel, timezone, members } = context;
  const initial = Object.fromEntries(members.map(member => {
    const state = context.states[member.id];
    return [member.id, { state: state && state !== "unknown" ? state : null,
      startsAt: presenceLocalTime(context.details[member.id]?.startsAt, timezone), endsAt: presenceLocalTime(context.details[member.id]?.endsAt, timezone) }];
  }));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initial);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const radioId = useId();
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initial);
  function setDraft(id: string, patch: Partial<Draft>) { setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } })); }
  function setAll(state: "present" | "absent") { setDrafts(Object.fromEntries(members.map(member => [member.id, { state, startsAt: "", endsAt: "" }]))); }
  async function save() {
    setSaving(true); setError("");
    try {
      if (!members.length) throw new Error("暂无可设置的成员。");
      if (members.some(member => !drafts[member.id]?.state)) throw new Error("请先为每位成员选择在场状态。");
      for (const member of members) {
        const draft = drafts[member.id];
        if (draft.state === "partial" && (!draft.startsAt || !draft.endsAt)) throw new Error(`${member.displayName}的部分在场时间需填写开始和结束时间。`);
        if (draft.state === "partial" && draft.endsAt <= draft.startsAt) throw new Error(`${member.displayName}的结束时间必须晚于开始时间。`);
      }
      const updates = members.map(member => ({ memberId: member.id, state: drafts[member.id].state!,
        startsAt: drafts[member.id].state === "partial" ? drafts[member.id].startsAt : null,
        endsAt: drafts[member.id].state === "partial" ? drafts[member.id].endsAt : null }));
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/plan/presence`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, members: updates }) });
      onSaved(Object.fromEntries(updates.map(update => [update.memberId, update.state])), Object.fromEntries(updates.map(update => [update.memberId, update])));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "当天成员保存失败。"); }
    finally { setSaving(false); }
  }
  return <EditorDialog open title={`${dayLabel}当天成员`} className="day-presence-editor" dirty={dirty} busy={saving} onClose={onClose} onSubmit={save} submitLabel="保存当天成员">
    <div className="presence-shortcuts"><button type="button" onClick={() => setAll("present")}>全员在场</button><button type="button" onClick={() => setAll("absent")}>全员不在场</button></div>
    <div className="presence-editor-members">{members.map(member => {
      const draft = drafts[member.id];
      return <fieldset key={member.id}><legend>{member.displayName}</legend>
        <div className="presence-editor-options">{([["present", "在场"], ["absent", "不在场"], ["partial", "部分在场"]] as const).map(([state, label]) => <label key={state}><input type="radio" name={`${radioId}-${member.id}`} checked={draft.state === state} onChange={() => setDraft(member.id, { state })} />{label}</label>)}</div>
        {draft.state === "partial" && <div className="presence-editor-times"><label>开始时间<input type="time" value={draft.startsAt} onChange={event => setDraft(member.id, { startsAt: event.target.value })} /></label><label>结束时间<input type="time" value={draft.endsAt} onChange={event => setDraft(member.id, { endsAt: event.target.value })} /></label></div>}
      </fieldset>;
    })}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </EditorDialog>;
}
