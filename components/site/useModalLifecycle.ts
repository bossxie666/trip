"use client";

import { useEffect, useRef, type RefObject } from "react";

const openDialogs: symbol[] = [];
let restoreBody: (() => void) | null = null;
let rootTrigger: HTMLElement | null = null;

/** One shared focus/scroll owner for modal dialogs, including nested dialogs. */
export function useModalLifecycle(open: boolean, surface: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = surface.current;
    if (!open || !dialog) return;
    const token = Symbol("dialog"), trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!openDialogs.length) {
      rootTrigger = trigger;
      const overflow = document.body.style.overflow, paddingRight = document.body.style.paddingRight;
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      if (gutter > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + gutter}px`;
      document.body.style.overflow = "hidden";
      restoreBody = () => { document.body.style.overflow = overflow; document.body.style.paddingRight = paddingRight; };
    }
    openDialogs.push(token);
    const isTop = () => openDialogs.at(-1) === token;
    const targets = () => [...dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]')]
      .filter(node => node.tabIndex >= 0 && !node.matches(':disabled,[hidden],[aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
    const focusFirst = () => (targets()[0] || dialog).focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => {
      // Autofocus or a quick keyboard action may already have placed focus.
      if (isTop() && !dialog.contains(document.activeElement)) focusFirst();
    });
    const keydown = (event: KeyboardEvent) => {
      // Let a focused child (for example a place-search popup) consume Escape
      // before dismissing the enclosing dialog. The stack still owns Tab.
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = targets(), first = items[0], last = items.at(-1), active = document.activeElement;
      if (!first) { event.preventDefault(); dialog.focus({ preventScroll: true }); }
      else if (!dialog.contains(active) || (event.shiftKey ? active === first || active === dialog : active === last)) {
        event.preventDefault(); (event.shiftKey ? last! : first).focus({ preventScroll: true });
      }
    };
    const focusin = (event: FocusEvent) => { if (isTop() && event.target instanceof Node && !dialog.contains(event.target)) focusFirst(); };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      cancelAnimationFrame(frame);
      const wasTop = isTop(), index = openDialogs.indexOf(token);
      if (index >= 0) openDialogs.splice(index, 1);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      if (!openDialogs.length) {
        restoreBody?.(); restoreBody = null;
        // A confirmation can unmount both itself and its parent in one commit.
        // Restore the outer trigger even if the parent cleaned up first.
        const target = rootTrigger; rootTrigger = null;
        if (target?.isConnected) target.focus({ preventScroll: true });
      } else if (wasTop && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, surface]);
}
