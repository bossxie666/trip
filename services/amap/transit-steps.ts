import type { AMapRouteStep } from "./amap-types";

const transitModes = new Set<AMapRouteStep["mode"]>(["subway", "bus"]);

function positive(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function addNullable(a: number | null, b: number | null) {
  if (a == null && b == null) return null;
  return (a || 0) + (b || 0);
}

function sameTransitLeg(a: AMapRouteStep, b: AMapRouteStep) {
  // Never merge two transit legs when the line identity is missing.  AMap
  // may return consecutive legs of different lines without a line name; in
  // that case keeping separate stages is safer than presenting a false
  // single-line ride.
  return a.mode === b.mode && transitModes.has(a.mode) && Boolean(a.lineName) && Boolean(b.lineName) && a.lineName === b.lineName && (!a.direction || !b.direction || a.direction === b.direction);
}

/**
 * Turn AMap's many tiny navigation segments into traveller-sized stages.
 * This function is deliberately pure so both Worker tests and the UI can use
 * exactly the same filtering/aggregation rules.
 */
export function aggregateTransitSteps(steps: AMapRouteStep[]): AMapRouteStep[] {
  const output: AMapRouteStep[] = [];
  for (const raw of steps) {
    const step = {
      ...raw,
      stationCount: raw.stationCount == null || !Number.isFinite(raw.stationCount) ? null : Math.round(raw.stationCount),
      durationSeconds: positive(raw.durationSeconds),
      distanceMeters: positive(raw.distanceMeters),
      instruction: raw.instruction?.trim() || null,
      lineName: raw.lineName?.trim() || null,
      direction: raw.direction?.trim() || null,
      fromStation: raw.fromStation?.trim() || null,
      toStation: raw.toStation?.trim() || null,
      transfer: raw.transfer?.trim() || null,
    };
    if ((step.mode === "subway" || step.mode === "bus") && (!step.lineName && !step.fromStation && !step.toStation && !step.transfer || raw.stationCount === 0)) continue;
    if (step.mode === "subway" || step.mode === "bus") {
      if (step.stationCount === 0) continue;
      const previous = output.at(-1);
      if (previous && sameTransitLeg(previous, step)) {
        previous.stationCount = previous.stationCount == null || step.stationCount == null ? previous.stationCount ?? step.stationCount : previous.stationCount + step.stationCount;
        previous.durationSeconds = addNullable(previous.durationSeconds, step.durationSeconds);
        previous.distanceMeters = addNullable(previous.distanceMeters, step.distanceMeters);
        previous.toStation = step.toStation || previous.toStation;
        previous.direction = previous.direction || step.direction;
        previous.polyline = [...(previous.polyline || []), ...(step.polyline || [])];
        continue;
      }
    }
    if (step.mode === "walking") {
      const previous = output.at(-1);
      if (previous?.mode === "walking") {
        previous.durationSeconds = addNullable(previous.durationSeconds, step.durationSeconds);
        previous.distanceMeters = addNullable(previous.distanceMeters, step.distanceMeters);
        previous.toStation = step.toStation || previous.toStation;
        previous.instruction = [previous.instruction, step.instruction].filter(Boolean).join("；") || null;
        previous.polyline = [...(previous.polyline || []), ...(step.polyline || [])];
        continue;
      }
    }
    if (step.mode === "other" && !step.transfer && !step.instruction) continue;
    output.push(step);
  }
  return output;
}

export function totalWalkingDistance(steps: AMapRouteStep[]) {
  return aggregateTransitSteps(steps).filter((step) => step.mode === "walking").reduce((sum, step) => sum + (step.distanceMeters || 0), 0);
}
