"use client";

import { useEffect } from "react";

/** Paper artwork is decorative: let the initial content paint before fetching it. */
export function DeferredJournalDecorations() {
  useEffect(() => {
    if (document.documentElement.dataset.decorReady) return;
    let idle = 0, secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const ready = () => { document.documentElement.dataset.decorReady = "true"; };
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(ready, { timeout: 1500 });
        else ready();
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); if (idle) window.cancelIdleCallback(idle); };
  }, []);
  return null;
}
