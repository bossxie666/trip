"use client";
import { FormEvent, useState } from "react";

export function UnlockForm({ returnTo = "/" }: { returnTo?: string }) {
  const [memberName, setMemberName] = useState("");
  const [code, setCode] = useState("");
  const [activationRequired, setActivationRequired] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      if (activationRequired && newPassword !== confirmPassword) throw new Error("两次输入的个人密码不一致。");
      const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberName, code, ...(activationRequired ? { newPassword } : {}) }) });
      const payload = await response.json() as { error?: string; activationRequired?: boolean };
      if (!response.ok) throw new Error(payload.error || "验证失败，请重试。");
      if (payload.activationRequired) { setActivationRequired(true); return; }
      location.assign(returnTo);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "验证失败，请重试。"); }
    finally { setLoading(false); }
  }
  return <form className="unlock-form" onSubmit={submit}>
    <label><span>你的名字</span><input required autoComplete="name" value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="输入已登记的成员名字" /></label>
    <label><span>{activationRequired ? "原旅行空间暗号" : "旅行空间暗号或个人密码"}</span><input type="password" autoComplete="current-password" required value={code} onChange={(event) => setCode(event.target.value)} /></label>
    {activationRequired && <><p>首次激活，请设置以后登录使用的个人密码。</p><label><span>个人密码</span><input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label><span>确认个人密码</span><input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></>}
    {error && <p role="alert">{error}</p>}
    <button disabled={loading}>{loading ? "正在处理…" : activationRequired ? "设置密码并进入" : "进入旅行空间"}</button>
    {!activationRequired && <button className="unlock-forgot" type="button" onClick={() => setRecoveryOpen((value) => !value)}>忘记密码</button>}
    {recoveryOpen && <p className="unlock-recovery" role="status">请联系网站管理员。管理员在右上角头像的“管理成员”中重置后，你可以用原旅行空间暗号重新设置个人密码。</p>}
  </form>;
}
