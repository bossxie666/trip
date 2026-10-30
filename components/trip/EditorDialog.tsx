"use client";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { X } from "lucide-react";
import { WorkspaceOverlay } from "./WorkspaceOverlay";

export function EditorDialog({ open, title, onClose, dirty = false, busy = false, onSubmit, submitLabel = "保存", discardMessage = "本次修改尚未保存。", children, actions, className = "" }: {
  open: boolean; title: string; onClose: () => void; dirty?: boolean; busy?: boolean;
  onSubmit?: () => void | Promise<void>; submitLabel?: string; children: ReactNode; actions?: ReactNode; className?: string;
  discardMessage?: string;
}) {
  const submitted = useRef(false);
  const [discard, setDiscard] = useState(false);
  const keepButton = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (discard) keepButton.current?.focus({ preventScroll: true }); }, [discard]);
  const keepEditing = () => {
    setDiscard(false);
    requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }));
  };
  const close = () => {
    if (busy || submitted.current) return;
    if (discard) { keepEditing(); return; }
    if (dirty) { setDiscard(true); return; }
    onClose();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!onSubmit || busy || submitted.current) return;
    submitted.current = true;
    try { await onSubmit(); } finally { submitted.current = false; }
  }
  return <WorkspaceOverlay open={open} onClose={close} ariaLabel={discard ? "放弃未保存修改" : title} className={`workspace-editor-dialog ${className}`.trim()}>
    <header className="editor-dialog-heading"><h2>{discard ? "放弃未保存修改？" : title}</h2><button ref={closeButton} type="button" className="workspace-close" disabled={busy} aria-label={discard ? "返回编辑" : `关闭${title}`} onClick={close}><X size={20} /></button></header>
    {discard ? <><p className="editor-discard-message">{discardMessage}</p><footer className="workspace-editor-actions"><button ref={keepButton} type="button" onClick={keepEditing}>继续编辑</button><button type="button" className="danger" onClick={() => { setDiscard(false); onClose(); }}>放弃修改</button></footer></> : <>
    <form className="workspace-editor-form" onSubmit={submit}>
      <fieldset className="workspace-editor-fields" disabled={busy}>{children}</fieldset>
      <footer className="workspace-editor-actions">{actions}<button type="button" disabled={busy} onClick={close}>取消</button>{onSubmit && <button type="submit" disabled={busy}>{busy ? "保存中…" : submitLabel}</button>}</footer>
    </form>
    </>}
  </WorkspaceOverlay>;
}
