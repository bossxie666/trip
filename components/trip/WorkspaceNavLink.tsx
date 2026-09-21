"use client";

import { useRouter } from "next/navigation";
import { forwardRef, useEffect, type AnchorHTMLAttributes, type MouseEvent } from "react";

type WorkspaceNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
};

/** Client-side workspace navigation that bypasses Vinext beta.2's broken Link dynamic import. */
export const WorkspaceNavLink = forwardRef<HTMLAnchorElement, WorkspaceNavLinkProps>(function WorkspaceNavLink({ href, prefetch = false, onClick, target, children, ...props }, ref) {
  const router = useRouter();

  useEffect(() => {
    if (prefetch) router.prefetch(href);
  }, [href, prefetch, router]);

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

  return <a {...props} ref={ref} href={href} target={target} onClick={navigate}>{children}</a>;
});
