"use client";
import { type ReactNode } from "react";

export function PlanningPanels({ library, itinerary, map }: { library: ReactNode; itinerary: ReactNode; map?: ReactNode }) {
  return <div className="plan-columns knowledge-compact"><div className="knowledge-plan-control">{library}</div><section className="itinerary-panel">{itinerary}</section>{map}</div>;
}
