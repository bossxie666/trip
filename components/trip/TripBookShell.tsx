"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

type View = "planning" | "map" | "budget";

export function TripBookShell({ view, previousHref, nextHref, children }: { view: View; previousHref?: string; nextHref?: string; children: ReactNode }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const go = (href?: string) => { if (href) router.push(href); };

  return <div className={`trip-book-shell trip-book-chapter-${view}`} onPointerDown={(event) => { if (event.pointerType !== "mouse") start.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x, dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.25) go(dx < 0 ? nextHref : previousHref);
  }} onPointerCancel={() => { start.current = null; }}>
    <div className="trip-book-leaf" key={view}>{children}</div>
    <button type="button" className="trip-page-corner trip-page-corner-left" aria-label="上一章节" disabled={!previousHref} onClick={() => go(previousHref)}><ChevronLeft /></button>
    <button type="button" className="trip-page-corner trip-page-corner-right" aria-label="下一章节" disabled={!nextHref} onClick={() => go(nextHref)}><ChevronRight /></button>
    <div className="trip-page-count" aria-live="polite">{view === "planning" ? "01" : view === "map" ? "02" : "03"} / 03</div>
  </div>;
}
