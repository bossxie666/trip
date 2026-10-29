"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import dynamic from "next/dynamic";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { GuestbookMessageView } from "@/services/guestbook-service.server";

const GuestbookEditor = dynamic(() => import("./GuestbookEditor").then(module => module.GuestbookEditor), { ssr: false });
function dateLabel(value: string) { return value.slice(0, 10).replaceAll("-", "."); }

export function GuestbookBoard({ initialMessages, currentMemberId, compact = false }: { initialMessages: GuestbookMessageView[]; currentMemberId: string; compact?: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [editor, setEditor] = useState<{ message?: GuestbookMessageView; deleting?: boolean } | null>(null);
  return <div className={`guestbook-board${compact ? " guestbook-compact" : ""}`}>
    {!compact && <button type="button" className="global-floating-add" aria-label="写下留言" onClick={() => setEditor({})}><Plus size={30} /></button>}
    {editor && <GuestbookEditor message={editor.message} initialDelete={editor.deleting} onClose={() => setEditor(null)}
      onSaved={saved => { setMessages(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]); setEditor(null); }}
      onDeleted={id => { setMessages(current => current.filter(item => item.id !== id)); setEditor(null); }} />}
    <div className="guestbook-notes">
      {messages.map((message, index) => <article key={message.id} className={`guestbook-note guestbook-note-${index % 3}`}>
        <header>{message.author.avatar ? <img src={message.author.avatar} alt="" width={34} height={34} /> : <i>{message.author.displayName.slice(0, 1).toUpperCase()}</i>}<div><b>{message.author.displayName}</b><time>{dateLabel(message.createdAt)}</time></div></header>
        {message.body && <p>{message.body}</p>}
        {!!message.media.length && <div className="guestbook-images">{message.media.map(media => <img key={media.id} src={`/api/media/${media.id}?variant=thumb`} alt="留言参考图" loading="lazy" width={240} height={180} />)}</div>}
        {message.author.id === currentMemberId && <footer><button onClick={() => setEditor({ message })}><Pencil size={13} />编辑</button><button onClick={() => setEditor({ message, deleting: true })}><Trash2 size={13} />删除</button></footer>}
      </article>)}
      {!messages.length && <div className="guestbook-empty"><img loading="lazy" className="guestbook-empty-paper" src="/assets/homepage-v3/paper-note-01.webp" alt="" aria-hidden="true" /><strong>还没有留言</strong></div>}
    </div>
  </div>;
}
