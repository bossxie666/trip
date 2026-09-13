export type RecommendationKind = "place" | "guide";
export type RecommendationGuideType = "day_trip" | null;
export type RecommendationCategory = "attraction" | "food" | "cafe" | "shopping" | "hotel" | "experience" | "other";
export type RecommendationPlaceRelation = "alternative" | "component";
export type BookingType = "flight" | "hotel" | "train" | "ticket" | "other";
export type BookingStatus = "tentative" | "confirmed" | "cancelled";
export type BookingTemporalKind = "instant" | "interval" | "date_range";
export type AllocationMode = "equal" | "custom";
export type PresenceState = "present" | "absent" | "unknown";
export type DayPresenceState = "present" | "absent" | "partial" | "unknown";
export type PresenceCoverage = "unknown" | "complete";
export type ItineraryItemType = "place" | "meal" | "transit" | "lodging" | "activity" | "note";
export type ParticipantOverride = "included" | "excluded";
export type ConstraintStrength = "soft" | "hard";
export type BudgetCategory = "food" | "local_transport" | "entertainment" | "shopping" | "other";
export type ExpenseScope = "personal" | "shared";
export type RoutePreferenceMode = "walking" | "transit" | "subway" | "bus" | "mixed_transit" | "taxi" | "bicycling";
export type RouteSource = "itinerary" | "booking";

export type TripSavedPlace = {
  id: string;
  tripId: string;
  placeId: string;
  createdByMemberId: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoutePreference = {
  id: string;
  tripId: string;
  dayId: string;
  fromSource: RouteSource;
  fromId: string;
  toSource: RouteSource;
  toId: string;
  memberId: string | null;
  preferredMode: RoutePreferenceMode;
  createdByMemberId: string | null;
  updatedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  endTimeLocal?: string | null;
  timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours";
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
  endTimeLocal?: string | null;
  timeMode?: "untimed" | "start_only" | "range" | "all_day" | "opening_hours";
  sortOrder: number | null;
  anchorKind?: "start" | "stay" | "end" | "timed";
  locked: boolean;
  placementOrder?: number | null;
};

export type DayTimelinePlacement = {
  dayId: string;
  sourceType: "itinerary_item" | "booking_anchor";
  sourceId: string;
  anchorType?: "departure" | "arrival" | "hotel_checkin" | "hotel_checkout" | "stay" | "other" | null;
  sortOrder: number;
};
