"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  // Render every editor at document level so sticky/positioned page content
  // cannot establish a stacking context above the drawer.  Lock only the
  // page scroll; the editor's own sheet remains the single scroll container
  // for long forms.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className={`workspace-overlay workspace-overlay-${mode}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`workspace-surface workspace-${mode} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {children}
    </section>
  </div>, document.body);
}
