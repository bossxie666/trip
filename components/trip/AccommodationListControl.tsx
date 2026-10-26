"use client";

import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { WorkspaceOverlay } from "./WorkspaceOverlay";

export function AccommodationListControl({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="accommodation-list-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>查看 / 编辑住宿</button>
    <WorkspaceOverlay open={open} onClose={() => setOpen(false)} ariaLabel="住宿" className="accommodation-list-dialog">
      <header className="editor-dialog-heading"><h2>住宿</h2><button type="button" aria-label="关闭住宿" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="accommodation-list-content">{children}</div>
    </WorkspaceOverlay>
  </>;
}
