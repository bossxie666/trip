import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookingCostAllocationRecords, bookingCostLineRecords, bookingParticipantRecords, bookingRecords, dayPresenceRecords, dayRecords,
  itineraryItemRecords, memberRecords, placeRecords, recommendationPlaceOptionRecords, itineraryItemParticipantOverrideRecords, memberPresenceWindowRecords,
  recommendationRecords, tripCityRecords, tripMemberRecords, tripRecords, tripSavedPlaceRecords, cityRecords,
  tripPlaceRecords, routePreferenceRecords,
} from "@/db/schema";
import { findTripBySlug } from "@/services/trip-repository.server";
import { getDayTimeline } from "@/services/day-timeline-service.server";
import { getPersonalBudgetWorkspace } from "@/services/budget-service.server";
import { assembleTimeline, type TimelineNode } from "@/services/timeline-assembler";

export async function getPlanWorkspace(slug: string, memberId?: string) {
  const trip = await findTripBySlug(slug);
  if (!trip) return null;
  const db = getDb();
  const stored = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!stored) return { trip, days: [], recommendations: [], bookings: [], costLines: [], presenceUnknown: true, budget: null, currentMemberId: memberId ?? null };

  const [days, recommendations, options, items, bookings, bookingParticipants, costLines, allocations, presenceRows, presenceWindows, dayPresenceRows, participantOverrides, savedPlaceRows, routePreferences, legacyTripPlaces] = await Promise.all([
    db.select().from(dayRecords).where(eq(dayRecords.tripId, stored.id)).orderBy(asc(dayRecords.dayNumber)),
    db.select().from(recommendationRecords).where(isNull(recommendationRecords.deletedAt)).orderBy(asc(recommendationRecords.createdAt), asc(recommendationRecords.id)),
    db.select({ option: recommendationPlaceOptionRecords, place: placeRecords, recommendation: recommendationRecords }).from(recommendationPlaceOptionRecords).innerJoin(recommendationRecords, eq(recommendationRecords.id, recommendationPlaceOptionRecords.recommendationId)).innerJoin(placeRecords, eq(placeRecords.id, recommendationPlaceOptionRecords.placeId)).where(isNull(recommendationRecords.deletedAt)).orderBy(asc(recommendationPlaceOptionRecords.sortOrder)),
    db.select({ item: itineraryItemRecords, place: placeRecords, recommendationTitle: recommendationRecords.title }).from(itineraryItemRecords).leftJoin(placeRecords, eq(placeRecords.id, itineraryItemRecords.placeId)).leftJoin(recommendationRecords, eq(recommendationRecords.id, itineraryItemRecords.recommendationId)).where(eq(itineraryItemRecords.tripId, stored.id)).orderBy(asc(itineraryItemRecords.dayId), asc(itineraryItemRecords.sortOrder), asc(itineraryItemRecords.id)),
    db.select({ booking: bookingRecords, place: placeRecords }).from(bookingRecords).leftJoin(placeRecords, eq(placeRecords.id, bookingRecords.placeId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt), ne(bookingRecords.status, "cancelled"))).orderBy(asc(bookingRecords.startAt), asc(bookingRecords.startDateLocal), asc(bookingRecords.id)),
    db.select().from(bookingParticipantRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingParticipantRecords.bookingId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt))),
    db.select().from(bookingCostLineRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingCostLineRecords.sortOrder)),
    db.select({ allocation: bookingCostAllocationRecords, memberName: memberRecords.displayName }).from(bookingCostAllocationRecords).innerJoin(bookingCostLineRecords, eq(bookingCostLineRecords.id, bookingCostAllocationRecords.costLineId)).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).innerJoin(memberRecords, eq(memberRecords.id, bookingCostAllocationRecords.memberId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingCostAllocationRecords.memberId)),
    db.select().from(tripMemberRecords).where(eq(tripMemberRecords.tripId, stored.id)),
    db.select().from(memberPresenceWindowRecords).where(eq(memberPresenceWindowRecords.tripId, stored.id)).orderBy(asc(memberPresenceWindowRecords.startsAt)),
    db.select().from(dayPresenceRecords).where(eq(dayPresenceRecords.tripId, stored.id)),
    db.select().from(itineraryItemParticipantOverrideRecords).innerJoin(itineraryItemRecords, eq(itineraryItemRecords.id, itineraryItemParticipantOverrideRecords.itineraryItemId)).where(eq(itineraryItemRecords.tripId, stored.id)),
    db.select({ saved: tripSavedPlaceRecords, place: placeRecords, city: cityRecords }).from(tripSavedPlaceRecords).innerJoin(placeRecords, eq(placeRecords.id, tripSavedPlaceRecords.placeId)).innerJoin(cityRecords, eq(cityRecords.id, placeRecords.cityId)).where(eq(tripSavedPlaceRecords.tripId, stored.id)).orderBy(asc(tripSavedPlaceRecords.createdAt)),
    db.select().from(routePreferenceRecords).where(eq(routePreferenceRecords.tripId, stored.id)).orderBy(asc(routePreferenceRecords.updatedAt), asc(routePreferenceRecords.id)),
    db.select({ place: placeRecords, planStatus: tripPlaceRecords.planStatus }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).where(eq(tripPlaceRecords.tripId, stored.id)),
  ]);

  const timelineByDay = new Map<string, Awaited<ReturnType<typeof getDayTimeline>>>();
  for (const day of days) {
    if (day.date && stored.timezone) timelineByDay.set(day.id, await getDayTimeline(stored.id, day.id));
    else timelineByDay.set(day.id, items.filter(({ item }) => item.dayId === day.id).map(({ item }) => ({ source: "itinerary" as const, sourceId: item.id, entryType: "itinerary-item" as const, bucket: "untimed" as const, title: item.title, timeLocal: item.startTimeLocal, sortOrder: item.sortOrder, locked: item.lockedAt != null })));
  }

  const bookingPlaceIds = [...new Set(bookings.flatMap(({ booking }) => [booking.placeId, booking.originPlaceId, booking.destinationPlaceId].filter((id): id is string => Boolean(id))) )];
  const bookingRelatedPlaces = bookingPlaceIds.length ? await db.select().from(placeRecords).where(inArray(placeRecords.id, bookingPlaceIds)) : [];
  const budget = memberId ? await getPersonalBudgetWorkspace(slug, memberId).catch(() => null) : null;
  const savedPlaces = savedPlaceRows.map(({ saved, place, city }) => ({ ...saved, place, city }));
  const placeById = new Map<string, typeof placeRecords.$inferSelect>();
  const recommendationMetaByPlace = new Map<string, { kind: "place" | "guide"; category: string; areaKey: string | null; title: string }>();
  for (const { place } of items) if (place) placeById.set(place.id, place);
  for (const { place } of bookings) if (place) placeById.set(place.id, place);
  for (const place of bookingRelatedPlaces) placeById.set(place.id, place);
  for (const { option, place, recommendation } of options) {
    void option;
    placeById.set(place.id, place);
    if (!recommendationMetaByPlace.has(place.id)) recommendationMetaByPlace.set(place.id, { kind: recommendation.kind, category: recommendation.category, areaKey: recommendation.areaKey, title: recommendation.title });
  }
  for (const { place } of savedPlaces) placeById.set(place.id, place);
  for (const { place } of legacyTripPlaces) placeById.set(place.id, place);
  const mapPlaces = [...placeById.values()].map((place) => {
    const formalItems = items.filter(({ item }) => item.placeId === place.id);
    const formal = formalItems.length > 0;
    const booking = bookings.some(({ booking }) => booking.placeId === place.id || booking.originPlaceId === place.id || booking.destinationPlaceId === place.id);
    const recommendation = options.some(({ option }) => option.placeId === place.id);
    const recommendationMeta = recommendationMetaByPlace.get(place.id);
    const saved = savedPlaces.some(({ place: savedPlace }) => savedPlace.id === place.id);
    // Legacy trip_places remains available for compatibility tooling, but it
    // is deliberately not used as a planning-state source for the new map.
    // Only an ItineraryItem can make a place selected/locked here.
    const planStatus = formalItems.some(({ item }) => item.lockedAt != null) ? "locked" as const : formal ? "selected" as const : "candidate" as const;
    return { place, kind: formal ? "itinerary" as const : booking ? "booking" as const : saved ? "saved" as const : recommendation ? "recommendation" as const : "candidate" as const, planStatus, category: recommendationMeta?.category || null, areaKey: recommendationMeta?.areaKey || null, recommendationTitle: recommendationMeta?.title || null };
  });
  const memberIds = presenceRows.map((member) => member.memberId);
  const timezoneOffset = stored.timezone === "Asia/Shanghai" ? "+08:00" : stored.timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
  const dayBounds = (date: string) => {
    const start = new Date(`${date}T00:00:00${timezoneOffset}`);
    return { start: start.getTime(), end: start.getTime() + 86_400_000 };
  };
  const dayPresenceDetail = (dayId: string, memberId: string) => dayPresenceRows.find((row) => row.dayId === dayId && row.memberId === memberId) || null;
  const dayPresenceState = (dayId: string, dayDate: string | null, memberId: string) => {
    const explicit = dayPresenceDetail(dayId, memberId);
    if (explicit) return explicit.state as "present" | "absent" | "partial";
    const coverage = presenceRows.find((row) => row.memberId === memberId)?.presenceCoverage;
    if (coverage !== "complete" || !dayDate || !stored.timezone) return "unknown" as const;
    const { start, end } = dayBounds(dayDate);
    const windows = presenceWindows.filter((window) => window.memberId === memberId).map((window) => ({ start: Date.parse(window.startsAt), end: window.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt) }));
    if (windows.some((window) => window.start <= start && end <= window.end)) return "present" as const;
    if (windows.some((window) => window.start < end && window.end > start)) return "unknown" as const;
    return "absent" as const;
  };
  const itemOverrides = (itemId: string) => Object.fromEntries(participantOverrides.filter(({ itinerary_item_participant_overrides: entry }) => entry.itineraryItemId === itemId).map(({ itinerary_item_participant_overrides: entry }) => [entry.memberId, entry.participation])) as Record<string, "included" | "excluded">;
  const itemStates = (item: typeof itineraryItemRecords.$inferSelect, dayDate: string | null) => Object.fromEntries(memberIds.map((memberId) => [memberId, item.startTimeLocal ? presenceState(item, memberId, dayDate) : dayPresenceState(item.dayId, dayDate, memberId)])) as Record<string, "present" | "absent" | "partial" | "unknown">;
  const bookingMemberStates = (bookingId: string) => {
    const participants = bookingParticipants.filter(({ booking_participants: participant }) => participant.bookingId === bookingId).map(({ booking_participants: participant }) => participant.memberId);
    return Object.fromEntries(presenceRows.map((member) => [member.memberId, participants.length ? (participants.includes(member.memberId) ? "present" : "absent") : "unknown"])) as Record<string, "present" | "absent" | "unknown">;
  };
  const presenceState = (item: typeof itineraryItemRecords.$inferSelect, memberId: string, dayDate: string | null) => {
    const override = participantOverrides.find(({ itinerary_item_participant_overrides: entry }) => entry.itineraryItemId === item.id && entry.memberId === memberId)?.itinerary_item_participant_overrides;
    if (override) return override.participation === "included" ? "present" : "absent";
    const coverage = presenceRows.find((row) => row.memberId === memberId)?.presenceCoverage;
    const explicit = dayPresenceDetail(item.dayId, memberId);
    if (explicit) {
      if (explicit.state === "present") return "present";
      if (explicit.state === "absent") return "absent";
      if (!item.startTimeLocal || !dayDate || (!explicit.startsAt && !explicit.endsAt)) return "unknown";
      const instant = Date.parse(`${dayDate}T${item.startTimeLocal}:00${timezoneOffset}`);
      const starts = explicit.startsAt ? Date.parse(explicit.startsAt) : Number.NEGATIVE_INFINITY;
      const ends = explicit.endsAt ? Date.parse(explicit.endsAt) : Number.POSITIVE_INFINITY;
      return Number.isFinite(instant) && starts <= instant && instant < ends ? "present" : "absent";
    }
    if (coverage !== "complete" || !item.startTimeLocal || !dayDate) return "unknown";
    const instant = Date.parse(`${dayDate}T${item.startTimeLocal}:00${timezoneOffset}`);
    if (!Number.isFinite(instant)) return "unknown";
    const windows = presenceWindows.filter((window) => window.memberId === memberId).some((window) => Date.parse(window.startsAt) <= instant && (window.endsAt == null || instant < Date.parse(window.endsAt)));
    return windows ? "present" : "absent";
  };
  const timelineAssembly = assembleTimeline({
    days: days.map((day) => ({ id: day.id, date: day.date, dayNumber: day.dayNumber })),
    items: items.map(({ item, place }) => ({ ...item, place, lockedAt: item.lockedAt, memberStates: itemStates(item, days.find((day) => day.id === item.dayId)?.date || null) })),
    bookings: bookings.map(({ booking }) => ({
      ...booking,
      originPlace: booking.originPlaceId ? bookingRelatedPlaces.find((candidate) => candidate.id === booking.originPlaceId) || null : null,
      destinationPlace: booking.destinationPlaceId ? bookingRelatedPlaces.find((candidate) => candidate.id === booking.destinationPlaceId) || null : null,
      memberStates: bookingMemberStates(booking.id),
    })),
  });
  type RouteStop = { id: string; source: "itinerary" | "booking"; title: string; place: typeof placeRecords.$inferSelect; sortOrder: number; memberStates?: Record<string, "present" | "absent" | "partial" | "unknown"> };
  const toRouteStop = (node: TimelineNode): RouteStop | null => node.place ? { id: node.id, source: node.source, title: node.title, place: node.place as typeof placeRecords.$inferSelect, sortOrder: node.sortOrder, memberStates: node.memberStates } : null;
  const routeStopsByDay = new Map<string, RouteStop[]>(), routeSegmentsByDay = new Map<string, { id: string; from: RouteStop; to: RouteStop; crossCity: boolean }[]>();
  for (const day of days) {
    const assembly = timelineAssembly[day.id];
    const stops = assembly.nodes.map(toRouteStop).filter((stop): stop is RouteStop => Boolean(stop));
    routeStopsByDay.set(day.id, stops);
    routeSegmentsByDay.set(day.id, assembly.localEdges.map((edge) => { const from = toRouteStop(edge.from), to = toRouteStop(edge.to); return from && to ? { id: edge.id, from, to, crossCity: edge.crossCity } : null; }).filter((segment): segment is { id: string; from: RouteStop; to: RouteStop; crossCity: boolean } => Boolean(segment)));
  }
  const bookingPlace = (id: string | null) => {
    const place = id ? bookingRelatedPlaces.find((candidate) => candidate.id === id) : null;
    return place || null;
  };
  return {
    trip,
    days: days.map((day) => ({ ...day, items: items.filter(({ item }) => item.dayId === day.id).map(({ item, place, recommendationTitle }) => ({ item, place, recommendationTitle, participantStates: itemStates(item, day.date), participantOverrides: itemOverrides(item.id) })), timeline: timelineByDay.get(day.id) || [] })),
    recommendations: recommendations.map((recommendation) => ({ ...recommendation, options: options.filter(({ option }) => option.recommendationId === recommendation.id), addedDays: items.filter(({ item }) => item.recommendationId === recommendation.id).map(({ item }) => item.dayId), locked: items.some(({ item }) => item.recommendationId === recommendation.id && item.lockedAt != null) })),
    bookings: bookings.map(({ booking, place }) => ({ booking, place, originPlace: bookingPlace(booking.originPlaceId), destinationPlace: bookingPlace(booking.destinationPlaceId), memberStates: bookingMemberStates(booking.id) })),
    costLines: costLines.map(({ booking_cost_lines: line, bookings: booking }) => ({ ...line, bookingTitle: booking.title, allocations: allocations.filter(({ allocation }) => allocation.costLineId === line.id) })),
    presenceUnknown: days.some((day) => memberIds.some((memberId) => dayPresenceState(day.id, day.date, memberId) === "unknown" || dayPresenceState(day.id, day.date, memberId) === "partial")),
    dayPresenceByDay: Object.fromEntries(days.map((day) => [day.id, Object.fromEntries(memberIds.map((memberId) => [memberId, dayPresenceState(day.id, day.date, memberId)]))])),
    dayPresenceDetailsByDay: Object.fromEntries(days.map((day) => [day.id, Object.fromEntries(memberIds.map((memberId) => { const value = dayPresenceDetail(day.id, memberId); return [memberId, value ? { state: value.state, startsAt: value.startsAt, endsAt: value.endsAt } : { state: dayPresenceState(day.id, day.date, memberId), startsAt: null, endsAt: null }]; }))])),
    budget,
    currentMemberId: memberId ?? null,
    savedPlaces,
    mapPlaces,
    routeStopsByDay: Object.fromEntries(routeStopsByDay),
    routeSegmentsByDay: Object.fromEntries(routeSegmentsByDay),
    timelineNodesByDay: Object.fromEntries(Object.entries(timelineAssembly).map(([dayId, assembly]) => [dayId, assembly.nodes])),
    timelineEdgesByDay: Object.fromEntries(Object.entries(timelineAssembly).map(([dayId, assembly]) => [dayId, assembly.edges])),
    routePreferences,
  };
}

export async function getNewPlanRoutePlaces(slug: string, originPlaceId: string, destinationPlaceId: string) {
  const db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) throw new Error("TRIP_NOT_FOUND");
  const ids = [originPlaceId, destinationPlaceId];
  const places = await db.select({ place: placeRecords }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, trip.id))).where(inArray(placeRecords.id, ids));
  if (places.length !== 2) throw new Error("PLACE_NOT_IN_TRIP");
  for (const { place } of places) {
    const [item, booking, option, saved] = await Promise.all([
      db.select({ id: itineraryItemRecords.id }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, trip.id), eq(itineraryItemRecords.placeId, place.id))).limit(1),
      db.select({ id: bookingRecords.id }).from(bookingRecords).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt), eq(bookingRecords.placeId, place.id))).limit(1),
      db.select({ id: recommendationPlaceOptionRecords.id }).from(recommendationPlaceOptionRecords).innerJoin(recommendationRecords, and(eq(recommendationRecords.id, recommendationPlaceOptionRecords.recommendationId), eq(recommendationRecords.tripId, trip.id), isNull(recommendationRecords.deletedAt))).where(eq(recommendationPlaceOptionRecords.placeId, place.id)).limit(1),
      db.select({ id: tripSavedPlaceRecords.id }).from(tripSavedPlaceRecords).where(and(eq(tripSavedPlaceRecords.tripId, trip.id), eq(tripSavedPlaceRecords.placeId, place.id))).limit(1),
    ]);
    const originOrDestination = (await db.select({ id: bookingRecords.id }).from(bookingRecords).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt), eq(bookingRecords.originPlaceId, place.id))).limit(1)).length || (await db.select({ id: bookingRecords.id }).from(bookingRecords).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt), eq(bookingRecords.destinationPlaceId, place.id))).limit(1)).length;
    if (!item.length && !booking.length && !option.length && !saved.length && !originOrDestination) throw new Error("PLACE_NOT_IN_TRIP");
  }
  const origin = places.find(({ place }) => place.id === originPlaceId)?.place, destination = places.find(({ place }) => place.id === destinationPlaceId)?.place;
  if (!origin || !destination) throw new Error("PLACE_NOT_IN_TRIP");
  if (origin.latitude == null || origin.longitude == null || destination.latitude == null || destination.longitude == null) throw new Error("PLACE_MISSING_COORDINATES");
  return { origin, destination };
}
