"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { GuestbookMessageView } from "@/services/guestbook-service.server";
import { WorkspaceOverlay } from "@/components/trip/WorkspaceOverlay";

function dateLabel(value: string) { return value.slice(0, 10).replaceAll("-", "."); }

export function GuestbookBoard({ initialMessages, currentMemberId, compact = false }: { initialMessages: GuestbookMessageView[]; currentMemberId: string; compact?: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function submit() {
    setBusy(true); setError("");
    try {
      const mediaAssetIds = [] as string[];
      for (const file of files) mediaAssetIds.push(await uploadMediaFile(file, "guestbook"));
      const response = await fetch("/api/guestbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, mediaAssetIds }) });
      const payload = await response.json() as { message?: GuestbookMessageView; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || "留言保存失败。");
      setMessages((value) => [payload.message!, ...value]); setBody(""); setFiles([]); setComposerOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "留言保存失败。"); }
    finally { setBusy(false); }
  }
  async function update(id: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/guestbook/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: editBody }) });
      const payload = await response.json() as { message?: GuestbookMessageView; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || "留言修改失败。");
      setMessages((value) => value.map((message) => message.id === id ? payload.message! : message)); setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "留言修改失败。"); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/guestbook/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "留言删除失败。");
      setMessages((value) => value.filter((message) => message.id !== id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "留言删除失败。"); }
    finally { setBusy(false); }
  }
  return <div className={`guestbook-board${compact ? " guestbook-compact" : ""}`}>
    {!compact && <button type="button" className="global-floating-add" aria-label="写下留言" onClick={() => setComposerOpen(true)}><Plus size={30} /></button>}
    {compact ? null : <WorkspaceOverlay open={composerOpen} onClose={() => { if (!busy) setComposerOpen(false); }} mode="modal" ariaLabel="写下留言" className="compact-editor-dialog"><header className="editor-dialog-heading"><h2>写下留言</h2><button type="button" aria-label="关闭" onClick={() => setComposerOpen(false)}><X size={20}/></button></header><div className="guestbook-composer">
      <textarea value={body} maxLength={1000} onChange={(event) => setBody(event.target.value)} placeholder="写下旅途里的话…" aria-label="留言内容" />
      <input ref={inputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 3))} />
      <div><button type="button" className="guestbook-image-button" onClick={() => inputRef.current?.click()}><ImagePlus size={16} />图片 {files.length ? `(${files.length}/3)` : ""}</button><button type="button" className="guestbook-submit" disabled={busy || (!body.trim() && !files.length)} onClick={() => void submit()}>{busy ? "保存中…" : "写下留言"}</button></div>
    </div></WorkspaceOverlay>}
    {error && <p className="guestbook-error" role="alert">{error}</p>}
    <div className="guestbook-notes">
      {messages.map((message, index) => <article key={message.id} className={`guestbook-note guestbook-note-${index % 3}`}>
        <header>{message.author.avatar ? <img src={message.author.avatar} alt="" width={34} height={34} /> : <i>{message.author.displayName.slice(0, 1).toUpperCase()}</i>}<div><b>{message.author.displayName}</b><time>{dateLabel(message.createdAt)}</time></div></header>
        {editing === message.id ? <textarea value={editBody} maxLength={1000} onChange={(event) => setEditBody(event.target.value)} /> : message.body && <p>{message.body}</p>}
        {!!message.media.length && <div className="guestbook-images">{message.media.map((media) => <img key={media.id} src={`/api/media/${media.id}?variant=thumb`} alt="留言参考图" loading="lazy" width={240} height={180} />)}</div>}
        {message.author.id === currentMemberId && <footer>{editing === message.id ? <><button disabled={busy} onClick={() => void update(message.id)}>保存</button><button onClick={() => setEditing(null)}>取消</button></> : <><button onClick={() => { setEditing(message.id); setEditBody(message.body || ""); }}><Pencil size={13} />编辑</button><button disabled={busy} onClick={() => void remove(message.id)}><Trash2 size={13} />删除</button></>}</footer>}
      </article>)}
      {!messages.length && <div className="guestbook-empty"><img className="guestbook-empty-paper" src="/assets/homepage-v3/paper-note-01.webp" alt="" aria-hidden="true" /><strong>还没有留言</strong></div>}
    </div>
  </div>;
}
