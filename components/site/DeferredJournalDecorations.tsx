"use client";

import { useEffect } from "react";

/** Paper artwork is decorative: let the initial content paint before fetching it. */
export function DeferredJournalDecorations() {
  useEffect(() => {
    if (document.documentElement.dataset.decorReady) return;
    let idle = 0, firstFrame = 0, secondFrame = 0;
    const afterLoad = () => { firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const ready = () => { document.documentElement.dataset.decorReady = "true"; };
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(ready, { timeout: 1500 });
        else ready();
      });
    }); };
    // CPU idle while modules are in flight is not network idle. Wait for load
    // before letting decorative artwork compete with the route's own scripts.
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return () => { window.removeEventListener("load", afterLoad); cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); if (idle) window.cancelIdleCallback(idle); };
  }, []);
  return null;
}
