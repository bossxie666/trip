"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type View = "planning" | "map" | "budget";

export function TripBookShell({ view, previousHref, nextHref, children }: { view: View; previousHref?: string; nextHref?: string; children: ReactNode }) {
  const router = useRouter();
  const go = (href?: string) => { if (href) router.push(href); };

  return <div className={`trip-book-shell trip-book-chapter-${view}`}>
    <div className="trip-book-leaf" key={view}>{children}</div>
    <button type="button" className="trip-page-corner trip-page-corner-left" aria-label="上一章节" disabled={!previousHref} onClick={() => go(previousHref)}><ChevronLeft /></button>
    <button type="button" className="trip-page-corner trip-page-corner-right" aria-label="下一章节" disabled={!nextHref} onClick={() => go(nextHref)}><ChevronRight /></button>
    <div className="trip-page-count" aria-live="polite">{view === "planning" ? "01" : view === "map" ? "02" : "03"} / 03</div>
  </div>;
}
