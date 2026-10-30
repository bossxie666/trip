"use client";
import { useRef, useState, type FormEvent } from "react";

export function RegisterForm({ returnTo = "/" }: { returnTo?: string }) {
  const [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const running = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    const form = new FormData(event.currentTarget);
    const fields = Object.fromEntries(form.entries());
    setError("");
    if (fields.password !== fields.confirmPassword) { setError("两次输入的个人密码不一致。"); return; }
    running.current = true; setLoading(true);
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fields) });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.message || payload.error || "注册失败，请重试。");
      location.assign(returnTo);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "注册失败，请重试。"); }
    finally { running.current = false; setLoading(false); }
  }
  return <form className="unlock-form" onSubmit={submit} aria-busy={loading}>
    <label><span>你的名字</span><input name="memberName" required minLength={2} maxLength={40} autoComplete="username" placeholder="以后使用这个名字登录" disabled={loading} /></label>
    <label><span>邀请码</span><input name="inviteCode" type="password" required autoComplete="off" placeholder="向管理员获取旅行空间暗号" disabled={loading} /></label>
    <label><span>个人密码</span><input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="设置 10–128 个字符的密码" disabled={loading} /></label>
    <label><span>确认个人密码</span><input name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="再次输入个人密码" disabled={loading} /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? "正在注册…" : "注册并进入旅行空间"}</button>
    <a className="unlock-auth-link" href={`/unlock?returnTo=${encodeURIComponent(returnTo)}`}>已有账号？返回登录</a>
  </form>;
}
