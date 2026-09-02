import { safeInternalReturnTo } from "./return-to.ts";

/**
 * Build the destination used when a member switches their real Session Member.
 *
 * The current page (including view/day filters) is retained, but the optional
 * `member` query is intentionally removed so the newly authenticated member
 * starts in their own Member View rather than inheriting the previous one.
 */
export function buildIdentitySwitchReturnTo(value: string | null | undefined): string {
  const safe = safeInternalReturnTo(value);
  if (safe === "/") return "/";

  const url = new URL(safe, "https://travel.local");
  url.searchParams.delete("member");
  return `${url.pathname}${url.search}${url.hash}`;
}
