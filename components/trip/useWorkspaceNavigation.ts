"use client";

import { useRouter } from "next/navigation";

/** React navigation/invalidation without tearing down the browser document. */
export function useWorkspaceNavigation() {
  const router = useRouter();
  return {
    refreshWorkspace: () => router.refresh(),
    openPlanningDay: (slug: string, dayId: string) => router.push(`/trips/${encodeURIComponent(slug)}/plan?view=planning&day=${encodeURIComponent(dayId)}`),
  };
}
