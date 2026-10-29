"use client";

import { useRouter } from "next/navigation";
import { planningDayHref } from "@/services/workspace-navigation";

/** React navigation/invalidation without tearing down the browser document. */
export function useWorkspaceNavigation() {
  const router = useRouter();
  return {
    refreshWorkspace: () => router.refresh(),
    openPlanningDay: (slug: string, dayId: string) => router.push(planningDayHref(typeof window === "undefined" ? null : window.location.href, slug, dayId)),
  };
}
