import { and, asc, count, desc, eq, inArray, isNull, like, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookingCostLineRecords, bookingParticipantRecords, bookingRecords, dayPresenceRecords,
  itineraryItemRecords, placeRecords, recommendationPlaceOptionRecords, itineraryItemParticipantOverrideRecords, memberPresenceWindowRecords,
  recommendationRecords, tripMemberRecords, tripRecords, tripSavedPlaceRecords, cityRecords,
  tripPlaceRecords, routePreferenceRecords,
} from "@/db/schema";
import { findTripBySlug } from "@/services/trip-repository.server";
import { getPersonalBudgetWorkspace } from "@/services/budget-service.server";
import { assembleTimeline, type TimelineNode } from "@/services/timeline-assembler";
import type { TripRequestContext } from "@/services/request-data-context.server";

export type PlanWorkspaceView = "planning" | "map" | "budget";
export type RecommendationQuery = {
  area: "shanghai" | "hangzhou" | "tonglu";
  category: "all" | "core" | "attraction" | "food" | "shopping" | "day_trip" | "other" | "cafe" | "guide";
  query: string;
  library: boolean;
  page: number;
  sort: "core" | "recent";
};

const defaultRecommendationQuery: RecommendationQuery = { area: "shanghai", category: "all", query: "", library: false, page: 1, sort: "core" };
const planningRecommendationLimit = 8;
const libraryRecommendationPageSize = 12;

export async function getPlanWorkspace(slug: string, memberId?: string, loaderOptions: { view?: PlanWorkspaceView; requestContext?: TripRequestContext; recommendations?: RecommendationQuery } = {}) {
  if (loaderOptions.requestContext && !loaderOptions.requestContext.permissions.canRead) return null;
  const trip = loaderOptions.requestContext?.trip?.slug === slug ? loaderOptions.requestContext.trip : await findTripBySlug(slug);
  if (!trip) return null;
  const db = getDb();
  const stored = trip;
  const view = loaderOptions.view || "planning";
  const needsRecommendations = view !== "budget";
  const paginatesRecommendations = view === "planning";
  const needsPresence = view !== "budget";
  const needsSavedPlaces = view !== "budget";
  // Planning renders the saved decision between adjacent concrete nodes;
  // Map and Costs consume the same row for route execution and estimates.
  const needsRoutes = true;
  const recommendationQuery = loaderOptions.recommendations || defaultRecommendationQuery;
  const recommendationConditions = [
    eq(recommendationRecords.tripId, stored.id),
    isNull(recommendationRecords.deletedAt),
  ];
  if (paginatesRecommendations) {
    recommendationConditions.push(eq(recommendationRecords.areaKey, recommendationQuery.area));
    if (recommendationQuery.category === "core") recommendationConditions.push(eq(recommendationRecords.isCore, true));
    else if (recommendationQuery.category === "day_trip") recommendationConditions.push(and(eq(recommendationRecords.kind, "guide"), eq(recommendationRecords.guideType, "day_trip"))!);
    else if (recommendationQuery.category === "guide") recommendationConditions.push(eq(recommendationRecords.kind, "guide"));
    else if (recommendationQuery.category === "other") recommendationConditions.push(inArray(recommendationRecords.category, ["other", "hotel", "experience"]));
    else if (recommendationQuery.category !== "all") recommendationConditions.push(eq(recommendationRecords.category, recommendationQuery.category));
    if (recommendationQuery.query) recommendationConditions.push(like(recommendationRecords.title, `%${recommendationQuery.query}%`));
  }
  const recommendationWhere = and(...recommendationConditions);
  const recommendationLimit = recommendationQuery.library ? libraryRecommendationPageSize : planningRecommendationLimit;
  const recommendationOffset = recommendationQuery.library ? (recommendationQuery.page - 1) * libraryRecommendationPageSize : 0;
  const recommendationOrder = recommendationQuery.sort === "recent"
    ? [desc(recommendationRecords.createdAt), desc(recommendationRecords.id)] as const
    : [desc(recommendationRecords.isCore), asc(recommendationRecords.createdAt), asc(recommendationRecords.id)] as const;
  const recommendationRowsPromise = needsRecommendations
    ? paginatesRecommendations
      ? db.select().from(recommendationRecords).where(recommendationWhere).orderBy(...recommendationOrder).limit(recommendationLimit).offset(recommendationOffset)
      : db.select().from(recommendationRecords).where(recommendationWhere).orderBy(...recommendationOrder)
    : Promise.resolve([]);
  const recommendationCountPromise = paginatesRecommendations
    ? db.select({ value: count() }).from(recommendationRecords).where(recommendationWhere)
    : Promise.resolve([{ value: 0 }]);
  const days = stored.days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
  const budgetPromise = view === "budget" && memberId ? getPersonalBudgetWorkspace(slug, memberId, loaderOptions.requestContext).catch(() => null) : Promise.resolve(null);

  const [recommendations, recommendationCountRows, items, bookings, bookingParticipants, presenceRows, presenceWindows, dayPresenceRows, participantOverrides, savedPlaceRows, routePreferences, legacyTripPlaces] = await Promise.all([
    recommendationRowsPromise,
    recommendationCountPromise,
    db.select({ item: itineraryItemRecords, place: placeRecords, recommendationTitle: recommendationRecords.title }).from(itineraryItemRecords).leftJoin(placeRecords, eq(placeRecords.id, itineraryItemRecords.placeId)).leftJoin(recommendationRecords, eq(recommendationRecords.id, itineraryItemRecords.recommendationId)).where(eq(itineraryItemRecords.tripId, stored.id)).orderBy(asc(itineraryItemRecords.dayId), asc(itineraryItemRecords.sortOrder), asc(itineraryItemRecords.id)),
    db.select({ booking: bookingRecords, place: placeRecords }).from(bookingRecords).leftJoin(placeRecords, eq(placeRecords.id, bookingRecords.placeId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt), ne(bookingRecords.status, "cancelled"))).orderBy(asc(bookingRecords.startAt), asc(bookingRecords.startDateLocal), asc(bookingRecords.id)),
    db.select().from(bookingParticipantRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingParticipantRecords.bookingId)).where(and(eq(bookingRecords.tripId, stored.id), isNull(bookingRecords.deletedAt))),
    db.select().from(tripMemberRecords).where(eq(tripMemberRecords.tripId, stored.id)),
    needsPresence ? db.select().from(memberPresenceWindowRecords).where(eq(memberPresenceWindowRecords.tripId, stored.id)).orderBy(asc(memberPresenceWindowRecords.startsAt)) : Promise.resolve([]),
    needsPresence ? db.select().from(dayPresenceRecords).where(eq(dayPresenceRecords.tripId, stored.id)) : Promise.resolve([]),
    needsPresence ? db.select().from(itineraryItemParticipantOverrideRecords).innerJoin(itineraryItemRecords, eq(itineraryItemRecords.id, itineraryItemParticipantOverrideRecords.itineraryItemId)).where(eq(itineraryItemRecords.tripId, stored.id)) : Promise.resolve([]),
    needsSavedPlaces ? db.select({ saved: tripSavedPlaceRecords, place: placeRecords, city: cityRecords }).from(tripSavedPlaceRecords).innerJoin(placeRecords, eq(placeRecords.id, tripSavedPlaceRecords.placeId)).innerJoin(cityRecords, eq(cityRecords.id, placeRecords.cityId)).where(eq(tripSavedPlaceRecords.tripId, stored.id)).orderBy(asc(tripSavedPlaceRecords.createdAt)) : Promise.resolve([]),
    needsRoutes ? db.select().from(routePreferenceRecords).where(eq(routePreferenceRecords.tripId, stored.id)).orderBy(asc(routePreferenceRecords.updatedAt), asc(routePreferenceRecords.id)) : Promise.resolve([]),
    needsSavedPlaces ? db.select({ place: placeRecords, planStatus: tripPlaceRecords.planStatus }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).where(eq(tripPlaceRecords.tripId, stored.id)) : Promise.resolve([]),
  ]);
  const recommendationIds = recommendations.map((recommendation) => recommendation.id);
  const options = recommendationIds.length
    ? await db.select({ option: recommendationPlaceOptionRecords, place: placeRecords, recommendation: recommendationRecords }).from(recommendationPlaceOptionRecords).innerJoin(recommendationRecords, eq(recommendationRecords.id, recommendationPlaceOptionRecords.recommendationId)).innerJoin(placeRecords, eq(placeRecords.id, recommendationPlaceOptionRecords.placeId)).where(inArray(recommendationPlaceOptionRecords.recommendationId, recommendationIds)).orderBy(asc(recommendationPlaceOptionRecords.sortOrder))
    : [];

  const timezone = stored.timezone || "Asia/Shanghai";

  const bookingPlaceIds = [...new Set(bookings.flatMap(({ booking }) => [booking.placeId, booking.originPlaceId, booking.destinationPlaceId].filter((id): id is string => Boolean(id))) )];
  const bookingIds = bookings.map(({ booking }) => booking.id);
  const [bookingRelatedPlaces, costLines, budget] = await Promise.all([
    bookingPlaceIds.length ? db.select().from(placeRecords).where(inArray(placeRecords.id, bookingPlaceIds)) : Promise.resolve([]),
    bookingIds.length ? db.select().from(bookingCostLineRecords).where(inArray(bookingCostLineRecords.bookingId, bookingIds)).orderBy(asc(bookingCostLineRecords.sortOrder)) : Promise.resolve([]),
    budgetPromise,
  ]);
  const savedPlaces = savedPlaceRows.map(({ saved, place, city }) => ({ ...saved, place, city }));
  const placeById = new Map<string, typeof placeRecords.$inferSelect>();
  const recommendationMetaByPlace = new Map<string, { id: string; kind: "place" | "guide"; category: string; areaKey: string | null; title: string; sortOrder: number }[]>();
  for (const { place } of items) if (place) placeById.set(place.id, place);
  for (const { place } of bookings) if (place) placeById.set(place.id, place);
  for (const place of bookingRelatedPlaces) placeById.set(place.id, place);
  for (const { option, place, recommendation } of options) {
    void option;
    placeById.set(place.id, place);
    const metadata = recommendationMetaByPlace.get(place.id) || [];
    if (!metadata.some((entry) => entry.id === recommendation.id)) metadata.push({ id: recommendation.id, kind: recommendation.kind, category: recommendation.category, areaKey: recommendation.areaKey, title: recommendation.title, sortOrder: option.sortOrder });
    recommendationMetaByPlace.set(place.id, metadata);
  }
  for (const { place } of savedPlaces) placeById.set(place.id, place);
  for (const { place } of legacyTripPlaces) placeById.set(place.id, place);
  const mapPlaces = [...placeById.values()].map((place) => {
    const formalItems = items.filter(({ item }) => item.placeId === place.id);
    const formal = formalItems.length > 0;
    const booking = bookings.some(({ booking }) => booking.placeId === place.id || booking.originPlaceId === place.id || booking.destinationPlaceId === place.id);
    const recommendation = options.some(({ option }) => option.placeId === place.id);
    const recommendationMeta = recommendationMetaByPlace.get(place.id) || [];
    const saved = savedPlaces.some(({ place: savedPlace }) => savedPlace.id === place.id);
    // Legacy trip_places remains available for compatibility tooling, but it
    // is deliberately not used as a planning-state source for the new map.
    // Only an ItineraryItem can make a place selected/locked here.
    const planStatus = formalItems.some(({ item }) => item.lockedAt != null) ? "locked" as const : formal ? "selected" as const : "candidate" as const;
    return { place, kind: formal ? "itinerary" as const : booking ? "booking" as const : saved ? "saved" as const : recommendation ? "recommendation" as const : "candidate" as const, planStatus, category: recommendationMeta[0]?.category || null, areaKey: recommendationMeta[0]?.areaKey || null, recommendationTitle: recommendationMeta[0]?.title || null, recommendations: recommendationMeta.map(({ id, title, kind, sortOrder }) => ({ id, title, kind, sortOrder })) };
  });
  const memberIds = presenceRows.map((member) => member.memberId);
  const timezoneOffset = timezone === "Asia/Shanghai" ? "+08:00" : timezone === "Asia/Tokyo" ? "+09:00" : "+00:00";
  const dayBounds = (date: string) => {
    const start = new Date(`${date}T00:00:00${timezoneOffset}`);
    return { start: start.getTime(), end: start.getTime() + 86_400_000 };
  };
  const dayPresenceDetail = (dayId: string, memberId: string) => dayPresenceRows.find((row) => row.dayId === dayId && row.memberId === memberId) || null;
  const dayPresenceState = (dayId: string, dayDate: string | null, memberId: string) => {
    const explicit = dayPresenceDetail(dayId, memberId);
    if (explicit) return explicit.state as "present" | "absent" | "partial";
    const coverage = presenceRows.find((row) => row.memberId === memberId)?.presenceCoverage;
    if (coverage !== "complete" || !dayDate) return "unknown" as const;
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
    days: days.map((day) => ({ ...day, items: items.filter(({ item }) => item.dayId === day.id).map(({ item, place, recommendationTitle }) => ({ item, place, recommendationTitle, participantStates: itemStates(item, day.date), participantOverrides: itemOverrides(item.id) })), timeline: [] })),
    recommendations: recommendations.map((recommendation) => ({ ...recommendation, options: options.filter(({ option }) => option.recommendationId === recommendation.id), addedDays: items.filter(({ item }) => item.recommendationId === recommendation.id).map(({ item }) => item.dayId), locked: items.some(({ item }) => item.recommendationId === recommendation.id && item.lockedAt != null) })),
    recommendationPage: { total: Number(recommendationCountRows[0]?.value || 0), page: recommendationQuery.page, pageSize: recommendationLimit, library: recommendationQuery.library },
    bookings: bookings.map(({ booking, place }) => ({ booking, place, originPlace: bookingPlace(booking.originPlaceId), destinationPlace: bookingPlace(booking.destinationPlaceId), memberStates: bookingMemberStates(booking.id) })),
    costLines,
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
  const places = await db.select({ place: placeRecords }).from(placeRecords).where(inArray(placeRecords.id, ids));
  if (places.length !== 2) throw new Error("PLACE_NOT_IN_TRIP");
  const [items, bookings, options, saved] = await Promise.all([
    db.select({ placeId: itineraryItemRecords.placeId }).from(itineraryItemRecords).where(and(eq(itineraryItemRecords.tripId, trip.id), inArray(itineraryItemRecords.placeId, ids))),
    db.select({ placeId: bookingRecords.placeId, originPlaceId: bookingRecords.originPlaceId, destinationPlaceId: bookingRecords.destinationPlaceId }).from(bookingRecords).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt))),
    db.select({ placeId: recommendationPlaceOptionRecords.placeId }).from(recommendationPlaceOptionRecords).innerJoin(recommendationRecords, and(eq(recommendationRecords.id, recommendationPlaceOptionRecords.recommendationId), eq(recommendationRecords.tripId, trip.id), isNull(recommendationRecords.deletedAt))).where(inArray(recommendationPlaceOptionRecords.placeId, ids)),
    db.select({ placeId: tripSavedPlaceRecords.placeId }).from(tripSavedPlaceRecords).where(and(eq(tripSavedPlaceRecords.tripId, trip.id), inArray(tripSavedPlaceRecords.placeId, ids))),
  ]);
  const referenced = new Set<string>([...items.map((row) => row.placeId), ...options.map((row) => row.placeId), ...saved.map((row) => row.placeId), ...bookings.flatMap((row) => [row.placeId, row.originPlaceId, row.destinationPlaceId])].filter((id): id is string => Boolean(id)));
  if (ids.some((id) => !referenced.has(id))) throw new Error("PLACE_NOT_IN_TRIP");
  const origin = places.find(({ place }) => place.id === originPlaceId)?.place, destination = places.find(({ place }) => place.id === destinationPlaceId)?.place;
  if (!origin || !destination) throw new Error("PLACE_NOT_IN_TRIP");
  if (origin.latitude == null || origin.longitude == null || destination.latitude == null || destination.longitude == null) throw new Error("PLACE_MISSING_COORDINATES");
  return { origin, destination };
}
