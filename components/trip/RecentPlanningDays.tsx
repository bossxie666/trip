"use client";

import { useEffect, useOptimistic, useRef, useTransition, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Page = { href: string; content: ReactNode };
const lifetimeMs = 60_000;

export function RecentPlanningDays({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const recent = useRef(new Map<string, { page: Page; saved: number }>());
  const dirtyContent = useRef<ReactNode>(null);
  const [preview, showPreview] = useOptimistic<Page | null>(null);
  const [, startNavigation] = useTransition();

  useEffect(() => {
    function invalidate() {
      recent.current.clear();
      dirtyContent.current = children;
    }
    function onClick(event: globalThis.MouseEvent) {
      if (event.target instanceof Element && event.target.closest("button, [role=button]")) invalidate();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", invalidate, true);
    document.addEventListener("visibilitychange", invalidate);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", invalidate, true);
      document.removeEventListener("visibilitychange", invalidate);
    };
  }, [children]);

  function openDay(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.defaultPrevented) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(".day-navigation a") : null;
    if (!link || link.target || link.hasAttribute("download")) return;
    const target = link.getAttribute("href");
    if (!target || target === href) return;

    const now = Date.now();
    for (const [key, entry] of recent.current) {
      if (now - entry.saved >= lifetimeMs) recent.current.delete(key);
    }
    if (dirtyContent.current !== children) {
      recent.current.delete(href);
      recent.current.set(href, { page: { href, content: children }, saved: now });
      const oldest = recent.current.keys().next().value;
      if (recent.current.size > 4 && oldest) recent.current.delete(oldest);
    }
    const cached = recent.current.get(target);
    if (!cached) return;
    event.preventDefault();
    startNavigation(() => {
      showPreview(cached.page);
      router.push(target);
    });
  }

  const showingPreview = preview && preview.href !== href;
  return <div style={{ display: "contents" }} onClickCapture={openDay} inert={showingPreview || undefined} aria-busy={showingPreview || undefined}>
    {showingPreview ? preview.content : children}
  </div>;
}
