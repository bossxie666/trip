/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useEffect, useState } from "react";

type PresenceState = "present" | "absent" | "unknown";
type Member = { id: string; displayName: string };

export function DayPresenceControl({ slug: providedSlug, dayId: providedDayId, dayLabel: providedDayLabel, members: providedMembers, initialStates: providedStates }: { slug?: string; dayId?: string; dayLabel?: string; members?: Member[]; initialStates?: Record<string, PresenceState> }) {
  const [context, setContext] = useState<{ slug: string; dayId: string; dayLabel: string; members: Member[]; states: Record<string, PresenceState> }>(() => ({ slug: providedSlug || "", dayId: providedDayId || "", dayLabel: providedDayLabel || "当天行程", members: providedMembers || [], states: providedStates || {} }));
  const { slug, dayId, dayLabel, members, states: initialStates } = context;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => members.filter((member) => initialStates?.[member.id] === "present").map((member) => member.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasUnknown = members.some((member) => !initialStates?.[member.id] || initialStates[member.id] === "unknown");

  useEffect(() => {
    if (!context.slug || !context.dayId) {
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const slugFromPath = pathParts[1] === "trips" ? pathParts[2] : "";
      const dayFromQuery = new URLSearchParams(window.location.search).get("day") || "";
      if (slugFromPath && dayFromQuery) {
        fetch(`/api/trips/${encodeURIComponent(slugFromPath)}/plan/presence?dayId=${encodeURIComponent(dayFromQuery)}`).then(async (response) => {
          if (!response.ok) return null;
          const payload = await response.json() as { day?: { id: string; title: string | null }; members?: Member[]; states?: Record<string, PresenceState> };
          if (!payload.day) return null;
          setContext({ slug: slugFromPath, dayId: payload.day.id, dayLabel: payload.day.title || "当天行程", members: payload.members || [], states: payload.states || {} });
          setSelected((payload.members || []).filter((member) => payload.states?.[member.id] === "present").map((member) => member.id));
          return null;
        }).catch(() => undefined);
      }
    }
    if (window.location.hash === `#day-presence-${dayId}`) setOpen(true);
  }, [context.dayId, context.slug, dayId]);

  function toggle(memberId: string) {
    setSelected((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/plan/presence`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayId, memberIds: selected }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "当天成员保存失败");
      location.assign(`/trips/${encodeURIComponent(slug)}/plan?view=planning&day=${encodeURIComponent(dayId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "当天成员保存失败"); setSaving(false); }
  }

  return <div id={`day-presence-${dayId}`} className="day-presence-control">
    <button type="button" className="day-presence-trigger" onClick={() => setOpen((current) => !current)}>{hasUnknown ? "当天成员 / 确认成员" : "当天成员 / 已确认"}</button>
    {open && <div className="day-presence-panel" role="dialog" aria-label={`${dayLabel}当天成员`}>
      <header><div><span>DAY PRESENCE</span><b>{dayLabel}</b></div><button type="button" onClick={() => setOpen(false)} aria-label="关闭">×</button></header>
      <p>勾选表示这一天在场；未勾选表示不在场。保存后写入明确的全天在场区间。</p>
      <div className="presence-member-list">{members.map((member) => <label key={member.id}><input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} /><span>{member.displayName}</span><small>{initialStates?.[member.id] === "unknown" || !initialStates?.[member.id] ? "待确认" : initialStates[member.id] === "present" ? "已在场" : "不在场"}</small></label>)}</div>
      <div className="presence-actions"><button type="button" onClick={() => setSelected(members.map((member) => member.id))}>全员参与</button><button type="button" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存当天成员"}</button></div>
      {error && <small className="form-error" role="alert">{error}</small>}
    </div>}
  </div>;
}
