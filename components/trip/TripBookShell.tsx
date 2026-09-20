"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

type View = "planning" | "map" | "budget";

export function TripBookShell({ view, previousHref, nextHref, children }: { view: View; previousHref?: string; nextHref?: string; children: ReactNode }) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const turning = useRef(false);

  function go(href: string | undefined, direction: "previous" | "next") {
    if (!href || turning.current) return;
    turning.current = true;
    shellRef.current?.classList.add(direction === "next" ? "turning-forward" : "turning-back");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(href), reduced ? 0 : 280);
  }

  return <div ref={shellRef} className={`trip-book-shell trip-book-chapter-${view}`} onPointerDown={(event) => { if (event.pointerType !== "mouse") start.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x, dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.25) go(dx < 0 ? nextHref : previousHref, dx < 0 ? "next" : "previous");
  }} onPointerCancel={() => { start.current = null; }}>
    <div className="trip-book-binding" aria-hidden="true" />
    <div className="trip-book-leaf" key={view}>{children}</div>
    <button type="button" className="trip-page-corner trip-page-corner-left" aria-label="上一章节" disabled={!previousHref} onClick={() => go(previousHref, "previous")}><ChevronLeft /></button>
    <button type="button" className="trip-page-corner trip-page-corner-right" aria-label="下一章节" disabled={!nextHref} onClick={() => go(nextHref, "next")}><ChevronRight /></button>
    <div className="trip-page-count" aria-live="polite">{view === "planning" ? "01" : view === "map" ? "02" : "03"} / 03</div>
  </div>;
}
