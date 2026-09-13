"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { buildIdentitySwitchReturnTo } from "@/services/identity-navigation";

export type SessionMemberSummary = { id: string; displayName: string; avatar?: string | null };

function currentPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function MemberIdentityControl({ currentMember, compact = false }: { currentMember?: SessionMemberSummary | null; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"switch" | "logout" | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!currentMember) return null;

  async function clearSession(destination: "switch" | "logout") {
    setBusy(destination);
    setError("");
    try {
      const response = await fetch("/api/session", { method: "DELETE", credentials: "same-origin", headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("旅行空间退出失败，请重试。");
      const returnTo = destination === "switch" ? buildIdentitySwitchReturnTo(currentPath()) : "/";
      window.location.assign(`/unlock?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "旅行空间退出失败，请重试。");
      setBusy(null);
    }
  }

  return <div className={`member-identity-control${compact ? " member-identity-compact" : ""}`} ref={rootRef}>
    <button type="button" className="member-identity-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(""); }}>
      {compact && (currentMember.avatar ? <img src={currentMember.avatar} alt="" width={34} height={34} /> : <i aria-hidden="true">{currentMember.displayName.slice(0, 1).toUpperCase()}</i>)}<span>{compact ? "成员" : "当前身份"}</span><strong>{currentMember.displayName}</strong><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="member-identity-menu" role="menu" aria-label="成员身份操作">
      <div className="member-identity-current"><div><span>当前身份</span><strong>{currentMember.displayName}</strong></div><button type="button" className="member-identity-close" aria-label="关闭身份菜单" onClick={() => setOpen(false)}>×</button></div>
      <button type="button" role="menuitem" onClick={() => void clearSession("switch")} disabled={busy !== null}>切换身份</button>
      <button type="button" role="menuitem" className="member-identity-logout" onClick={() => void clearSession("logout")} disabled={busy !== null}>退出旅行空间</button>
      {busy && <small className="member-identity-status">{busy === "switch" ? "正在准备切换…" : "正在退出…"}</small>}
      {error && <small className="member-identity-error" role="alert">{error}</small>}
    </div>}
  </div>;
}
