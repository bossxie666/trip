"use client";

import { useRef, type ReactNode, type FormEvent } from "react";
import { X } from "lucide-react";
import { WorkspaceOverlay } from "./WorkspaceOverlay";

export function EditorDialog({ open, title, onClose, dirty = false, busy = false, onSubmit, submitLabel = "保存", children, actions }: {
  open: boolean; title: string; onClose: () => void; dirty?: boolean; busy?: boolean;
  onSubmit?: () => void | Promise<void>; submitLabel?: string; children: ReactNode; actions?: ReactNode;
}) {
  const submitted = useRef(false);
  const close = () => {
    if (busy || submitted.current) return;
    if (dirty && !window.confirm("修改尚未保存，确定放弃修改？")) return;
    onClose();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!onSubmit || busy || submitted.current) return;
    submitted.current = true;
    try { await onSubmit(); } finally { submitted.current = false; }
  }
  return <WorkspaceOverlay open={open} onClose={close} ariaLabel={title} className="workspace-editor-dialog">
    <header className="editor-dialog-heading"><h2>{title}</h2><button type="button" className="workspace-close" disabled={busy} aria-label={`关闭${title}`} onClick={close}><X size={20} /></button></header>
    <form className="workspace-editor-form" onSubmit={submit}>
      <fieldset className="workspace-editor-fields" disabled={busy}>{children}</fieldset>
      <footer className="workspace-editor-actions">{actions}<button type="button" disabled={busy} onClick={close}>取消</button>{onSubmit && <button type="submit" disabled={busy}>{busy ? "保存中…" : submitLabel}</button>}</footer>
    </form>
  </WorkspaceOverlay>;
}
