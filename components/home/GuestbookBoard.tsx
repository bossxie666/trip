"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import dynamic from "next/dynamic";
import { Heart, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { EditorDialog } from "@/components/trip/EditorDialog";
import { editorRequest } from "@/components/trip/editor-request";
import type { GuestbookMessageView } from "@/services/guestbook-service.server";

const GuestbookEditor = dynamic(() => import("./GuestbookEditor").then(module => module.GuestbookEditor), { ssr: false });
function dateLabel(value: string) { return value.slice(0, 10).replaceAll("-", "."); }
type MemberOption = { id: string; displayName: string };

export function GuestbookBoard({ initialMessages, currentMemberId, members = [], compact = false }: { initialMessages: GuestbookMessageView[]; currentMemberId: string; members?: MemberOption[]; compact?: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [editor, setEditor] = useState<{ message?: GuestbookMessageView; deleting?: boolean } | null>(null);
  const save = (saved: GuestbookMessageView) => setMessages(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]);
  return <div className={`guestbook-board${compact ? " guestbook-compact" : ""}`}>
    {!compact && <button type="button" className="global-floating-add" aria-label="写下留言" onClick={() => setEditor({})}><Plus size={30} /></button>}
    {editor && <GuestbookEditor message={editor.message} currentMemberId={currentMemberId} members={members} initialDelete={editor.deleting} onClose={() => setEditor(null)}
      onSaved={saved => { save(saved); setEditor(null); }}
      onDeleted={id => { setMessages(current => current.filter(item => item.id !== id)); setEditor(null); }} />}
    <div className="guestbook-notes">
      {messages.map((message, index) => <GuestbookNote key={message.id} message={message} index={index} memberId={currentMemberId} onSaved={save} onEdit={deleting => setEditor({ message, deleting })} />)}
      {!messages.length && <div className="guestbook-empty"><strong>还没有留言</strong></div>}
    </div>
  </div>;
}

function GuestbookNote({ message, index, memberId, onSaved, onEdit }: { message: GuestbookMessageView; index: number; memberId: string; onSaved: (saved: GuestbookMessageView) => void; onEdit: (deleting?: boolean) => void }) {
  const [replying, setReplying] = useState(false), [draft, setDraft] = useState("");
  const [deletingReply, setDeletingReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const likes = message.likes ?? [], replies = message.replies ?? [];
  const liked = likes.some(person => person.id === memberId);
  async function perform(path: string, method: string, body?: object) {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const result = await editorRequest<{ message: GuestbookMessageView }>(`/api/guestbook/${encodeURIComponent(message.id)}${path}`, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
      onSaved(result.message); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失败，请重试。"); return false; }
    finally { setBusy(false); }
  }
  async function submitReply() {
    if (deletingReply) { if (await perform(`/replies/${encodeURIComponent(deletingReply)}`, "DELETE")) setDeletingReply(null); }
    else if (await perform("/replies", "POST", { body: draft })) setDraft("");
  }
  return <article className={`guestbook-note guestbook-note-${index % 3}`}>
    <header>{message.author.avatar ? <img src={message.author.avatar} alt="" width={34} height={34} /> : <i>{message.author.displayName.slice(0, 1).toUpperCase()}</i>}<div><b>{message.author.displayName}</b><time dateTime={message.createdAt}>{dateLabel(message.createdAt)}</time></div>{message.visibility === "selected" && <span className="guestbook-private">指定成员可见</span>}</header>
    {message.body && <p>{message.body}</p>}
    {!!message.media.length && <div className="guestbook-images">{message.media.map(media => <img key={media.id} src={`/api/media/${media.id}?variant=thumb`} alt="留言图片" loading="lazy" width={240} height={180} />)}</div>}
    <footer>
      <button type="button" aria-label={liked ? "取消点赞" : "点赞"} aria-pressed={liked} disabled={busy} onClick={() => void perform("/like", "PUT", { liked: !liked })}><Heart size={16} fill={liked ? "currentColor" : "none"} />{likes.length || "点赞"}</button>
      <button type="button" onClick={() => { setError(""); setReplying(true); }}><MessageCircle size={16} />回复{replies.length ? ` ${replies.length}` : ""}</button>
      {message.author.id === memberId && <><button type="button" onClick={() => onEdit()}><Pencil size={13} />编辑</button><button type="button" onClick={() => onEdit(true)}><Trash2 size={13} />删除</button></>}
    </footer>
    {!!likes.length && <p className="guestbook-likes">{likes.map(person => person.displayName).join("、")} 赞了</p>}
    {!!replies.length && <div className="guestbook-reply-preview">{replies.slice(-2).map(reply => <p key={reply.id}><b>{reply.author.displayName}：</b>{reply.body}</p>)}</div>}
    {error && !replying && <p role="alert" className="form-error">{error}</p>}
    {replying && <EditorDialog open title={deletingReply ? "删除回复" : "回复留言"} onClose={() => { if (deletingReply) setDeletingReply(null); else { setReplying(false); setError(""); } }} dirty={!deletingReply && !!draft.trim()} busy={busy} onSubmit={submitReply} submitLabel={deletingReply ? "确认删除" : "发送"}>
      {deletingReply ? <p>确定删除这条回复吗？</p> : <>
        <div className="guestbook-thread">{replies.length ? replies.map(reply => <div key={reply.id}><div><b>{reply.author.displayName}</b><time dateTime={reply.createdAt}>{dateLabel(reply.createdAt)}</time>{reply.author.id === memberId && <button type="button" aria-label={`删除${reply.author.displayName}的回复`} disabled={busy} onClick={() => setDeletingReply(reply.id)}><Trash2 size={15} /></button>}</div><p>{reply.body}</p></div>) : <p>暂无回复</p>}</div>
        <label>回复内容<textarea rows={3} maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} /></label>
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </EditorDialog>}
  </article>;
}
