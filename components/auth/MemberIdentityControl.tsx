"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
export type SessionMemberSummary = { id: string; displayName: string; avatar?: string | null; role?: "admin" | "member" };
const MemberProfileDialog = dynamic(() => import("./MemberProfileDialog").then(module => module.MemberProfileDialog), { ssr: false });

export function MemberIdentityControl({ currentMember, compact = false }: { currentMember?: SessionMemberSummary | null; compact?: boolean }) {
  const [member, setMember] = useState(currentMember), [open, setOpen] = useState(false);
  useEffect(() => {
    const update = (event: Event) => { const changed = (event as CustomEvent<SessionMemberSummary>).detail; setMember(current => current?.id === changed.id ? { ...current, ...changed, role: changed.role || current.role } : current); };
    window.addEventListener("member-avatar-updated", update);
    return () => window.removeEventListener("member-avatar-updated", update);
  }, []);
  if (!member) return null;
  return <div className={`member-identity-control${compact ? " member-identity-compact" : ""}`}>
    <button type="button" className="member-identity-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      {member.avatar ? <img src={member.avatar} alt="" width={36} height={36} /> : <i aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</i>}
      <strong>{member.displayName}</strong><span aria-hidden="true">⌄</span>
    </button>
    {open && <MemberProfileDialog member={member} onClose={() => setOpen(false)} />}
  </div>;
}
