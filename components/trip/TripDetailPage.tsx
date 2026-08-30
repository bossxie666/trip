import type { ReactNode } from "react";
import type { Trip } from "@/models/travel";

type TripDetailPageProps = {
  trip: Trip;
  children: ReactNode;
};

/** Stable boundary for Overview, Decision, Budget, Days, Checklist and Photos. */
export function TripDetailPage({ trip, children }: TripDetailPageProps) {
  void trip;
  return <>{children}</>;
}
