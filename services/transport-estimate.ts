import type { AMapRouteMode } from "./amap/amap-types";

export type TransportParticipantState = "present" | "absent" | "partial" | "unknown";

export type TransportEstimate = {
  amountMinor: number | null;
  pending: boolean;
  reason?: "route" | "fare" | "participants" | "member";
  participantCount?: number;
};

/**
 * A route participant must be present at both ends of a segment.  The map
 * read-model supplies independent presence/override states for each stop;
 * keeping this merge here prevents callers from accidentally counting only
 * the origin (or falling back to StageMember counts).
 */
export function mergeTransportParticipantStates(
  from: Record<string, TransportParticipantState> | undefined = {},
  to: Record<string, TransportParticipantState> | undefined = {},
) {
  const ids = new Set([...Object.keys(from), ...Object.keys(to)]);
  return Object.fromEntries([...ids].map((id) => {
    const a = from[id] || "unknown";
    const b = to[id] || "unknown";
    const state = a === "unknown" || b === "unknown" ? "unknown"
      : a === "partial" || b === "partial" ? "partial"
      : a === "present" && b === "present" ? "present"
      : "absent";
    return [id, state];
  })) as Record<string, TransportParticipantState>;
}

/**
 * Convert one AMap route result into the current member's expected share.
 * This is deliberately pure: no StageMember count, network request or UI
 * state is consulted here, so Budget and Planning use identical semantics.
 */
export function estimateTransportCost(input: {
  mode: AMapRouteMode;
  transitCost?: number | null;
  taxiCost?: number | null;
  memberId?: string | null;
  memberStates?: Record<string, TransportParticipantState>;
}): TransportEstimate {
  if (input.mode === "walking" || input.mode === "bicycling") return { amountMinor: 0, pending: false };
  if (!input.memberId) return { amountMinor: null, pending: true, reason: "member" };
  const state = input.memberStates?.[input.memberId] || "unknown";
  if (state === "absent") return { amountMinor: 0, pending: false, participantCount: 0 };
  if (state !== "present") return { amountMinor: null, pending: true, reason: "participants" };
  if (input.mode === "taxi" || input.mode === "driving") {
    if (input.taxiCost == null) return { amountMinor: null, pending: true, reason: "fare" };
    const states = Object.values(input.memberStates || {});
    if (!states.length || states.some((value) => value === "unknown" || value === "partial")) return { amountMinor: null, pending: true, reason: "participants" };
    const participantCount = states.filter((value) => value === "present").length;
    if (!participantCount) return { amountMinor: 0, pending: false, participantCount: 0 };
    return { amountMinor: Math.round((input.taxiCost * 100) / participantCount), pending: false, participantCount };
  }
  if (input.transitCost == null) return { amountMinor: null, pending: true, reason: "fare" };
  return { amountMinor: Math.round(input.transitCost * 100), pending: false, participantCount: 1 };
}
