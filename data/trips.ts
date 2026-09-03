import type { Trip } from "@/models/travel";

/**
 * Development-only fallback records. Production trips are the D1 source of
 * truth; keeping this list empty prevents stale Shanghai/Hangzhou planning
 * data from shadowing the formal workspace.
 */
export const trips: Trip[] = [];

export function getTripBySlug(slug: string) {
  return trips.find((trip) => trip.slug === slug);
}
