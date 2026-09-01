"use client";
import { useState, type ReactNode } from "react";
import { DayPresenceControl } from "./DayPresenceControl";

export function PlanningPanels({ library, itinerary, dayPresence }: { library: ReactNode; itinerary: ReactNode; dayPresence?: ReactNode }) {
  const [active, setActive] = useState<"library" | "itinerary">("itinerary");
  return <>{dayPresence || <DayPresenceControl />}<div className={`plan-columns mobile-${active}`}><div className="mobile-plan-tabs" role="tablist" aria-label="规划内容"><button type="button" role="tab" aria-selected={active === "library"} onClick={() => setActive("library")}>素材</button><button type="button" role="tab" aria-selected={active === "itinerary"} onClick={() => setActive("itinerary")}>当天行程</button></div><section className="recommendation-panel">{library}</section><section className="itinerary-panel">{itinerary}</section></div></>;
}
