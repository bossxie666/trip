"use client";

import { useRouter } from "next/navigation";
import { forwardRef, useRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

type WorkspaceNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

/** Client-side workspace navigation that bypasses Vinext beta.2's broken Link dynamic import. */
export const WorkspaceNavLink = forwardRef<HTMLAnchorElement, WorkspaceNavLinkProps>(function WorkspaceNavLink({ href, onClick, onPointerEnter, onTouchStart, onFocus, target, children, ...props }, ref) {
  const router = useRouter();
  const prefetched = useRef(false);

  function prefetch() {
    if (prefetched.current || typeof window === "undefined") return;
    const targetUrl = new URL(href, window.location.href);
    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;
    prefetched.current = true;
    router.prefetch(href);
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.currentTarget.hasAttribute("download") ||
      (target && target !== "_self")
    ) return;

    event.preventDefault();
    router.push(href);
  }

  return <a {...props} ref={ref} href={href} target={target} onClick={navigate} onPointerEnter={(event) => { onPointerEnter?.(event); prefetch(); }} onTouchStart={(event) => { onTouchStart?.(event); prefetch(); }} onFocus={(event) => { onFocus?.(event); prefetch(); }}>{children}</a>;
});
