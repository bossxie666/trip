"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, KeyRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useModalLifecycle } from "@/components/site/useModalLifecycle";
import { buildIdentitySwitchReturnTo } from "@/services/identity-navigation";
import { uploadMediaFile } from "@/components/media/client-upload";
import { EditorDialog } from "@/components/trip/EditorDialog";
import { editorRequest } from "@/components/trip/editor-request";
import type { SessionMemberSummary } from "./MemberIdentityControl";

type ManagedMember = { id: string; displayName: string; active: boolean; role: string; credentialStatus: string; lastLoginAt: string | null };
type SessionAction = "switch" | "logout" | "logout-all";
type ProfileAction = "avatar" | "password" | "members" | SessionAction;
function currentPath() { return `${window.location.pathname}${window.location.search}${window.location.hash}`; }

export function MemberProfileDialog({ member, onClose }: { member: SessionMemberSummary; onClose: () => void }) {
  const [busy, setBusy] = useState<ProfileAction | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false), [currentPassword, setCurrentPassword] = useState(""), [newPassword, setNewPassword] = useState(""), [confirmPassword, setConfirmPassword] = useState("");
  const [managedMembers, setManagedMembers] = useState<ManagedMember[] | null>(null), [resetTarget, setResetTarget] = useState<ManagedMember | null>(null);
  const [discardAction, setDiscardAction] = useState<"close" | SessionAction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), surfaceRef = useRef<HTMLElement>(null), running = useRef(false);
  const dirty = Boolean(currentPassword || newPassword || confirmPassword);
  useModalLifecycle(true, surfaceRef, close);
  function close() { if (running.current) return; if (dirty) setDiscardAction("close"); else onClose(); }
  async function run(action: ProfileAction, operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(action); setError("");
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "操作失败，请重试。"); }
    finally { running.current = false; setBusy(null); }
  }
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    await run("avatar", async () => {
      const assetId = await uploadMediaFile(file, "member_avatar");
      const payload = await editorRequest<{ member?: SessionMemberSummary }>("/api/member", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId }) });
      if (!payload.member) throw new Error("头像更新失败。");
      window.dispatchEvent(new CustomEvent("member-avatar-updated", { detail: payload.member }));
    });
  }
  async function clearSession(destination: SessionAction) {
    await run(destination, async () => {
      await editorRequest(`/api/session${destination === "logout-all" ? "?all=true" : ""}`, { method: "DELETE", credentials: "same-origin" });
      const returnTo = destination === "switch" ? buildIdentitySwitchReturnTo(currentPath()) : "/";
      window.location.assign(`/unlock?returnTo=${encodeURIComponent(returnTo)}`);
    });
  }
  function requestSession(action: SessionAction) { if (dirty) setDiscardAction(action); else void clearSession(action); }
  async function loadMembers() {
    const payload = await editorRequest<{ members?: ManagedMember[] }>("/api/admin/members", { cache: "no-store" });
    if (!payload.members) throw new Error("成员读取失败。");
    setManagedMembers(payload.members);
  }
  async function setMemberActive(target: ManagedMember) {
    await editorRequest("/api/admin/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: target.id, active: !target.active }) });
    await loadMembers();
  }
  function requestReset(target: ManagedMember) { setError(""); setNotice(""); setResetTarget(target); }
  async function resetMemberPassword() {
    if (!resetTarget) return;
    await run("members", async () => {
      await editorRequest("/api/admin/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: resetTarget.id, action: "reset-password" }) });
      setNotice(`已重置 ${resetTarget.displayName}，请让对方用原暗号重新激活。`);
      setResetTarget(null);
      await loadMembers();
    });
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault(); if (running.current) return; setError(""); setNotice("");
    if (newPassword !== confirmPassword) { setError("两次输入的新密码不一致。"); return; }
    await run("password", async () => {
      await editorRequest("/api/member/password", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordOpen(false); setNotice("密码已更新，其他设备已退出。");
    });
  }
  return <>
    {createPortal(<div className="member-profile-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={surfaceRef} tabIndex={-1} className="member-profile-dialog" role="dialog" aria-modal="true" aria-label="个人资料">
        <header><h2>个人资料</h2><button type="button" aria-label="关闭" onClick={close} disabled={!!busy}><X size={20} /></button></header>
<div className="member-profile-avatar">{member.avatar ? <img src={member.avatar} alt={`${member.displayName}的头像`} /> : <i>{member.displayName.slice(0, 1).toUpperCase()}</i>}<button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}><Camera size={17} />{busy === "avatar" ? "上传中…" : "更换头像"}</button><input ref={inputRef} type="file" disabled={!!busy} hidden accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={uploadAvatar} /></div><label className="member-profile-name"><span>名字</span><input readOnly value={member.displayName} /></label><section className="member-password-panel"><button type="button" onClick={() => { setPasswordOpen((value) => !value); setError(""); setNotice(""); }} disabled={!!busy}><KeyRound size={16} />修改密码</button>{passwordOpen && <form onSubmit={changePassword}><label><span>当前密码</span><input type="password" disabled={!!busy} autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label><span>新密码</span><input type="password" disabled={!!busy} autoComplete="new-password" minLength={10} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label><span>确认新密码</span><input type="password" disabled={!!busy} autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button type="submit" disabled={!!busy}>{busy === "password" ? "保存中…" : "保存新密码"}</button></form>}</section>{member.role === "admin" && <section className="member-admin-panel"><button type="button" onClick={() => void run("members", loadMembers)} disabled={!!busy}>{managedMembers ? "刷新成员" : "管理成员"}</button>{managedMembers?.map((target) => <div key={target.id}><span><b>{target.displayName}</b><small>{target.credentialStatus === "active" ? "个人密码已启用" : target.active ? "待激活" : "已停用"}</small></span><span className="member-admin-actions">{target.active && target.credentialStatus === "active" && <button type="button" disabled={!!busy || target.id === member.id} onClick={() => requestReset(target)}>重置密码</button>}<button type="button" disabled={!!busy || target.id === member.id} onClick={() => void run("members", () => setMemberActive(target))}>{target.active ? "停用" : "重新启用"}</button></span></div>)}</section>}{notice && <p className="member-identity-notice" role="status">{notice}</p>}{error && <p className="member-identity-error" role="alert">{error}</p>}<footer><button type="button" onClick={() => requestSession("switch")} disabled={!!busy}>切换身份</button><button type="button" onClick={() => requestSession("logout-all")} disabled={!!busy}>退出全部设备</button><button type="button" className="member-identity-logout" onClick={() => requestSession("logout")} disabled={!!busy}>退出</button></footer>
      </section>
    </div>, document.body)}
    {discardAction && <EditorDialog open title="放弃未保存修改" busy={!!busy} onClose={() => { setDiscardAction(null); setError(""); }} submitLabel="放弃修改"
      onSubmit={async () => { if (discardAction === "close") onClose(); else await clearSession(discardAction); }}>
      <p>密码修改尚未保存。</p>{error && <p role="alert">{error}</p>}
    </EditorDialog>}
    {resetTarget && <EditorDialog open title="重置成员密码" busy={!!busy} onClose={() => { setResetTarget(null); setError(""); }} submitLabel="确认重置"
      onSubmit={resetMemberPassword}>
      <p>确认重置 {resetTarget.displayName} 的密码？该成员的所有设备会立即退出，需要重新激活。</p>
      {error && <p role="alert">{error}</p>}
    </EditorDialog>}
  </>;
}
