export type RecommendationKind = "place" | "guide";
export type RecommendationCategory = "attraction" | "food" | "cafe" | "shopping" | "hotel" | "experience" | "other";
export type RecommendationPlaceRelation = "alternative" | "component";
export type BookingType = "flight" | "hotel" | "train" | "ticket" | "other";
export type BookingStatus = "tentative" | "confirmed" | "cancelled";
export type BookingTemporalKind = "instant" | "interval" | "date_range";
export type AllocationMode = "equal" | "custom";
export type PresenceState = "present" | "absent" | "unknown";
export type PresenceCoverage = "unknown" | "complete";
export type ItineraryItemType = "place" | "meal" | "transit" | "lodging" | "activity" | "note";
export type ParticipantOverride = "included" | "excluded";
export type ConstraintStrength = "soft" | "hard";
export type BudgetCategory = "food" | "local_transport" | "entertainment" | "shopping" | "other";
export type ExpenseScope = "personal" | "shared";

export type MoneyAllocation = {
  memberId: string;
  amountMinor: number;
  notes?: string | null;
};

export type PresenceWindow = {
  id: string;
  startsAt: string;
  endsAt: string | null;
};

export type TimelineBooking = {
  id: string;
  type: BookingType;
  title: string;
  temporalKind: BookingTemporalKind;
  startAt: string | null;
  endAt: string | null;
  startDateLocal: string | null;
  endDateLocal: string | null;
};

export type TimelineItineraryItem = {
  id: string;
  title: string;
  startTimeLocal: string | null;
  sortOrder: number;
  lockedAt: string | null;
};

export type DayTimelineEntry = {
  source: "booking" | "itinerary";
  sourceId: string;
  entryType: "booking-anchor" | "itinerary-item";
  bucket: "start-of-day" | "timed" | "untimed" | "end-of-day";
  title: string;
  timeLocal: string | null;
  sortOrder: number | null;
  anchorKind?: "start" | "stay" | "end" | "timed";
  locked: boolean;
};
