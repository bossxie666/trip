"use client";

import { useEffect, useRef } from "react";
import { WorkspaceNavLink } from "./WorkspaceNavLink";

type DayNavigationItem = {
  id: string;
  href: string;
  dateLabel: string;
  areaLabel: string;
  active: boolean;
};

/**
 * A book-index style day rail. On narrow screens the selected date is brought
 * into view without changing the document's vertical scroll position.
 */
export function DayNavigation({ items }: { items: DayNavigationItem[] }) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 680px)").matches) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [items]);

  return <nav className="day-navigation" aria-label="选择日期">
    {items.map((item, index) => <WorkspaceNavLink
      className={item.active ? "active" : ""}
      key={item.id}
      href={item.href}
      ref={item.active ? activeRef : undefined}
      aria-current={item.active ? "date" : undefined}
    >
      <small>DAY {String(index + 1).padStart(2, "0")}</small>
      <b>{item.dateLabel}</b>
      <span>{item.areaLabel}</span>
    </WorkspaceNavLink>)}
  </nav>;
}
