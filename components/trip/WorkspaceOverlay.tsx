"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalLifecycle } from "@/components/site/useModalLifecycle";

type OverlayMode = "modal" | "drawer";

/**
 * Shared visual shell for planning editors.  It owns only presentation and
 * keyboard/backdrop dismissal; each feature keeps its own form state,
 * exclusive-modal event owner, and API semantics.
 */
export function WorkspaceOverlay({ open, onClose, mode = "modal", ariaLabel, ariaLabelledBy, className = "", children }: {
  open: boolean;
  onClose: () => void;
  mode?: OverlayMode;
  ariaLabel: string;
  ariaLabelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLElement>(null);
  useModalLifecycle(open, surfaceRef, onClose);

  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className={`workspace-overlay workspace-overlay-${mode}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={surfaceRef} tabIndex={-1} className={`workspace-surface workspace-${mode} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {children}
    </section>
  </div>, document.body);
}
