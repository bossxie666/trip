"use client";

import type { ReactNode } from "react";

type View = "planning" | "map" | "budget";

export function TripBookShell({ view, children }: { view: View; children: ReactNode }) {
  return <div className={`trip-book-shell trip-book-chapter-${view}`}>
    <div className="trip-book-leaf" key={view}>{children}</div>
    <div className="trip-page-count" aria-live="polite">{view === "planning" ? "01" : view === "map" ? "02" : "03"} / 03</div>
  </div>;
}
