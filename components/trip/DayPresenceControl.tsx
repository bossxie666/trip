"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { editorRequest } from "./editor-request";

export type PresenceState = "present" | "absent" | "partial" | "unknown";
export type PresenceDetail = { state: PresenceState; startsAt?: string | null; endsAt?: string | null };
export type PresenceContext = { slug: string; dayId: string; dayLabel: string; timezone: string; members: { id: string; displayName: string }[]; states: Record<string, PresenceState>; details: Record<string, PresenceDetail> };
export type DayPresenceProps = { slug?: string; dayId?: string; dayLabel?: string; timezone?: string; members?: PresenceContext["members"]; initialStates?: PresenceContext["states"]; initialDetails?: PresenceContext["details"] };
const DayPresenceEditor = dynamic(() => import("./DayPresenceEditor").then(module => module.DayPresenceEditor), { ssr: false });

export function DayPresenceControl(props: DayPresenceProps) {
  return <PresenceControlState key={`${props.slug}:${props.dayId}`} {...props} />;
}
function PresenceControlState(props: DayPresenceProps) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [fallback, setFallback] = useState<PresenceContext | null>(null), [loadError, setLoadError] = useState(""), [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<{ base: string; states: PresenceContext["states"]; details: PresenceContext["details"] } | null>(null);
  const context: PresenceContext | null = props.slug && props.dayId ? { slug: props.slug, dayId: props.dayId, dayLabel: props.dayLabel || "当天行程", timezone: props.timezone || "Asia/Shanghai", members: props.members || [], states: props.initialStates || {}, details: props.initialDetails || {} } : fallback;
  const slug = context?.slug || "", dayId = context?.dayId || "";
  const modalOwner = `presence:${slug}:${dayId}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  useEffect(() => {
    if (props.slug && props.dayId) return;
    const path = window.location.pathname.split("/").filter(Boolean), fallbackSlug = path[0] === "trips" ? path[1] : "", fallbackDay = new URLSearchParams(window.location.search).get("day") || "";
    const controller = new AbortController();
    if (fallbackSlug && fallbackDay) {
      editorRequest<{ day?: { id: string; title: string | null }; timezone?: string; members?: PresenceContext["members"]; states?: PresenceContext["states"]; details?: PresenceContext["details"] }>(`/api/trips/${encodeURIComponent(fallbackSlug)}/plan/presence?dayId=${encodeURIComponent(fallbackDay)}`, { signal: controller.signal }).then(payload => {
        if (controller.signal.aborted) return;
        if (!payload.day) throw new Error("当天成员数据不可用。");
        setLoadError("");
        setFallback({ slug: fallbackSlug, dayId: payload.day.id, dayLabel: payload.day.title || "当天行程", timezone: payload.timezone || "Asia/Shanghai", members: payload.members || [], states: payload.states || {}, details: payload.details || {} });
      }).catch(caught => { if (!controller.signal.aborted) setLoadError(caught instanceof Error ? caught.message : "当天成员读取失败。"); });
    }
    return () => controller.abort();
  }, [props.slug, props.dayId, retry]);
  useEffect(() => {
    if (!dayId) return;
    const openFromHash = () => { if (window.location.hash === `#day-presence-${dayId}`) { requestTripModalOpen(modalOwner); setOpen(true); } };
    window.addEventListener("hashchange", openFromHash); openFromHash();
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [dayId, modalOwner]);
  const base = JSON.stringify([context?.members, context?.states, context?.details]);
  const current = context && saved?.base === base ? { ...context, states: saved.states, details: saved.details } : context;
  const hasUnknown = !current || current.members.some(member => !current.states[member.id] || current.states[member.id] === "unknown");
  return <div id={`day-presence-${dayId}`} className="day-presence-control">
    <button type="button" className="day-presence-trigger" disabled={!current} onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>{hasUnknown ? "设置当天成员" : "当天成员 · 已确认"}</button>
    {loadError && <p className="form-error" role="alert">{loadError}<button type="button" onClick={() => setRetry(value => value + 1)}>重试</button></p>}
    {open && current && <DayPresenceEditor context={current} onClose={() => setOpen(false)} onSaved={(states, details) => { setSaved({ base, states, details }); setOpen(false); refreshWorkspace(); }} />}
  </div>;
}
