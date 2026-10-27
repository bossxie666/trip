"use client";

import { useEffect, useState } from "react";
import type { SessionMemberSummary } from "@/components/auth/MemberIdentityControl";
import { SiteHeader } from "./SiteHeader";

/** Error recovery must remain usable even when the route's server data failed. */
export function RecoveryHeader({ active = "" }: { active?: "trips" | "" }) {
  const [member, setMember] = useState<SessionMemberSummary | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/member", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async response => response.ok ? response.json() as Promise<{ member: SessionMemberSummary }> : null)
      .then(payload => { if (!controller.signal.aborted && payload?.member) setMember(payload.member); })
      .catch(() => { /* Navigation and retry stay available when member lookup also fails. */ });
    return () => controller.abort();
  }, []);
  return <SiteHeader key={member?.id || "recovery"} currentMember={member} active={active} />;
}
