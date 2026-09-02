"use client";

import { useState } from "react";
import { buildIdentitySwitchReturnTo } from "@/services/identity-navigation";

export type SessionMemberSummary = { id: string; displayName: string };

function currentPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function MemberIdentityControl({ currentMember }: { currentMember?: SessionMemberSummary | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"switch" | "logout" | null>(null);
  const [error, setError] = useState("");

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

  return <div className="member-identity-control">
    <button type="button" className="member-identity-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(""); }}>
      <span>当前身份</span><strong>{currentMember.displayName}</strong><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="member-identity-menu" role="menu" aria-label="成员身份操作">
      <div className="member-identity-current"><span>当前身份</span><strong>{currentMember.displayName}</strong></div>
      <button type="button" role="menuitem" onClick={() => void clearSession("switch")} disabled={busy !== null}>切换身份</button>
      <button type="button" role="menuitem" className="member-identity-logout" onClick={() => void clearSession("logout")} disabled={busy !== null}>退出旅行空间</button>
      {busy && <small className="member-identity-status">{busy === "switch" ? "正在准备切换…" : "正在退出…"}</small>}
      {error && <small className="member-identity-error" role="alert">{error}</small>}
    </div>}
  </div>;
}
