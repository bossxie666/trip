"use client";
import { useEffect, useMemo, useState } from "react";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { WorkspaceOverlay } from "./WorkspaceOverlay";

type PresenceState = "present" | "absent" | "partial" | "unknown";
type Member = { id: string; displayName: string };
type PresenceDetail = { state: PresenceState; startsAt?: string | null; endsAt?: string | null };
type PresenceChoice = Exclude<PresenceState, "unknown">;
type Draft = { state: PresenceChoice | null; startsAt: string; endsAt: string };

function timeValue(value: string | null | undefined) {
  if (!value) return "";
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] || (value.match(/^(\d{2}:\d{2})$/)?.[1] || "");
}

export function DayPresenceControl({ slug: providedSlug, dayId: providedDayId, dayLabel: providedDayLabel, members: providedMembers, initialStates: providedStates, initialDetails: providedDetails }: { slug?: string; dayId?: string; dayLabel?: string; members?: Member[]; initialStates?: Record<string, PresenceState>; initialDetails?: Record<string, PresenceDetail> }) {
  const [context, setContext] = useState<{ slug: string; dayId: string; dayLabel: string; members: Member[]; states: Record<string, PresenceState>; details: Record<string, PresenceDetail> }>(() => ({ slug: providedSlug || "", dayId: providedDayId || "", dayLabel: providedDayLabel || "当天行程", members: providedMembers || [], states: providedStates || {}, details: providedDetails || {} }));
  const { slug, dayId, dayLabel, members, states } = context;
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries((providedMembers || []).map((member) => {
    const detail = providedDetails?.[member.id];
    const state = (providedStates?.[member.id] === "partial" ? "partial" : providedStates?.[member.id] === "absent" ? "absent" : providedStates?.[member.id] === "present" ? "present" : null) as Draft["state"];
    return [member.id, { state, startsAt: timeValue(detail?.startsAt), endsAt: timeValue(detail?.endsAt) }];
  })));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const hasUnknown = useMemo(() => members.some((member) => !states[member.id] || states[member.id] === "unknown"), [members, states]);
  const modalOwner = `presence:${slug}:${dayId}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));

  function setDraft(memberId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [memberId]: { ...(current[memberId] || { state: null, startsAt: "", endsAt: "" }), ...patch } }));
  }

  useEffect(() => {
    if (!context.slug || !context.dayId) {
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const slugFromPath = pathParts[0] === "trips" ? pathParts[1] : "";
      const dayFromQuery = new URLSearchParams(window.location.search).get("day") || "";
      if (slugFromPath && dayFromQuery) {
        fetch(`/api/trips/${encodeURIComponent(slugFromPath)}/plan/presence?dayId=${encodeURIComponent(dayFromQuery)}`).then(async (response) => {
          if (!response.ok) return null;
          const payload = await response.json() as { day?: { id: string; title: string | null }; members?: Member[]; states?: Record<string, PresenceState>; details?: Record<string, PresenceDetail> };
          if (!payload.day) return null;
          const nextMembers = payload.members || [];
          setContext({ slug: slugFromPath, dayId: payload.day.id, dayLabel: payload.day.title || "当天行程", members: nextMembers, states: payload.states || {}, details: payload.details || {} });
          setDrafts(Object.fromEntries(nextMembers.map((member) => { const detail = payload.details?.[member.id]; const state = payload.states?.[member.id] === "absent" ? "absent" : payload.states?.[member.id] === "partial" ? "partial" : payload.states?.[member.id] === "present" ? "present" : null; return [member.id, { state, startsAt: timeValue(detail?.startsAt), endsAt: timeValue(detail?.endsAt) }]; })));
          return null;
        }).catch(() => undefined);
      }
    }
    const openFromHash = () => { if (window.location.hash === `#day-presence-${dayId}`) { requestTripModalOpen(modalOwner); setOpen(true); } };
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [context.dayId, context.slug, dayId, modalOwner]);

  async function save() {
    setSaving(true); setError("");
    try {
      if (members.some((member) => !drafts[member.id]?.state)) throw new Error("请先为每位成员选择在场状态。");
      const body = { dayId, members: members.map((member) => { const draft = drafts[member.id] || { state: null, startsAt: "", endsAt: "" }; const state = draft.state || "absent"; return { memberId: member.id, state, startsAt: state === "partial" ? (draft.startsAt || null) : null, endsAt: state === "partial" ? (draft.endsAt || null) : null }; }) };
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/presence`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "当天成员保存失败");
      location.assign(`/trips/${encodeURIComponent(slug)}/plan?view=planning&day=${encodeURIComponent(dayId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "当天成员保存失败"); setSaving(false); }
  }

  return <div id={`day-presence-${dayId}`} className="day-presence-control">
    <button type="button" className="day-presence-trigger" onClick={() => { if (!open) requestTripModalOpen(modalOwner); setOpen((current) => !current); }}>{hasUnknown ? "设置当天成员" : "当天成员 · 已确认"}</button>
    <WorkspaceOverlay open={open} onClose={() => setOpen(false)} mode="modal" ariaLabel={`${dayLabel}当天成员`} className="day-presence-panel">
      <header><div><span>DAY PRESENCE</span><b>{dayLabel}</b></div><button type="button" className="workspace-close" onClick={() => setOpen(false)} aria-label="关闭">×</button></header>
      <p>这里确认这一天谁实际在场。部分在场可以只填抵达或离开时间；未填写的成员不会被默认为在场。</p>
      <div className="presence-member-list">{members.map((member) => { const draft = drafts[member.id] || { state: null, startsAt: "", endsAt: "" }; const currentState = states[member.id] || "unknown"; return <fieldset key={member.id} className="presence-member-row"><legend>{member.displayName}<small>{currentState === "unknown" ? "当天成员尚未设置" : currentState === "partial" ? "部分在场" : currentState === "present" ? "在场" : "不在场"}</small></legend><div className="presence-state-options"><label><input type="radio" name={`presence-${member.id}`} checked={draft.state === "present"} onChange={() => setDraft(member.id, { state: "present" })}/>在场</label><label><input type="radio" name={`presence-${member.id}`} checked={draft.state === "absent"} onChange={() => setDraft(member.id, { state: "absent" })}/>不在场</label><label><input type="radio" name={`presence-${member.id}`} checked={draft.state === "partial"} onChange={() => setDraft(member.id, { state: "partial" })}/>部分在场</label></div>{draft.state === "partial" && <div className="presence-time-fields"><label>开始时间<input type="time" value={draft.startsAt} onChange={(event) => setDraft(member.id, { startsAt: event.target.value })}/></label><label>结束时间<input type="time" value={draft.endsAt} onChange={(event) => setDraft(member.id, { endsAt: event.target.value })}/></label></div>}</fieldset>; })}</div>
      <div className="presence-actions"><button type="button" className="button-secondary" onClick={() => setDrafts(Object.fromEntries(members.map((member) => [member.id, { state: "present" as const, startsAt: "", endsAt: "" }]))) }>全员在场</button><button type="button" className="button-secondary" onClick={() => setDrafts(Object.fromEntries(members.map((member) => [member.id, { state: "absent" as const, startsAt: "", endsAt: "" }]))) }>全员不在场</button><button type="button" className="button-primary" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存当天成员"}</button></div>
      {error && <small className="form-error" role="alert">{error}</small>}
    </WorkspaceOverlay>
  </div>;
}
