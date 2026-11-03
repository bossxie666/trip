export function tripCoverCardUrl(cover: string | null) {
  if (!cover) return null;
  if (cover === "/og.png" || cover === "/og-card.jpg") return "/assets/trip-placeholder-card.webp";
  if (cover.startsWith("/api/media/")) {
    const url = new URL(cover, "https://trip.invalid");
    url.searchParams.set("variant", "card");
    return url.pathname + url.search;
  }
  return cover;
}
