const fallbackPath = "/";

export function safeInternalReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallbackPath;
  try {
    const url = new URL(value, "https://travel.local");
    if (url.origin !== "https://travel.local" || url.pathname === "/unlock" || url.pathname === "/api/session") return fallbackPath;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallbackPath;
  }
}
