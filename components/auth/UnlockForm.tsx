"use client";
import { FormEvent, useState } from "react";

export function UnlockForm() {
  const [memberName, setMemberName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberName, code }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error || "验证失败，请重试。"); setLoading(false); return; }
    location.href = "/trips";
  }
  return <form className="unlock-form" onSubmit={submit}>
    <label><span>你的名字</span><input required autoComplete="name" value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="输入已登记的成员名字" /></label>
    <label><span>旅行空间暗号</span><input type="password" autoComplete="current-password" required value={code} onChange={(event) => setCode(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={loading}>{loading ? "正在进入…" : "进入旅行空间"}</button>
  </form>;
}
