"use client";

import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

type WorkspaceNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

/** Client-side workspace navigation that bypasses Vinext beta.2's broken Link dynamic import. */
export function WorkspaceNavLink({ href, onClick, target, children, ...props }: WorkspaceNavLinkProps) {
  const router = useRouter();

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

  return <a {...props} href={href} target={target} onClick={navigate}>{children}</a>;
}
