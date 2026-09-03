/**
 * The planning timeline's single read-model assembler.
 *
 * It deliberately stores no facts: itinerary items and bookings remain the
 * source of truth.  The result is a deterministic Node -> Edge -> Node view
 * consumed by both the planning workspace and the route map.
 */

export type TimelinePlace = {
  id: string;
  name: string;
  cityId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
};

export type TimelineItemInput = {
  id: string;
  dayId: string;
  title: string;
  sortOrder: number;
  place?: TimelinePlace | null;
  placeId?: string | null;
  startTimeLocal?: string | null;
  endTimeLocal?: string | null;
  timeMode?: string | null;
  lockedAt?: string | null;
  memberStates?: Record<string, "present" | "absent" | "partial" | "unknown">;
  [key: string]: unknown;
};

export type TimelineBookingInput = {
  id: string;
  title: string;
  type: string;
  startDateLocal?: string | null;
  endDateLocal?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string | null;
  originPlace?: TimelinePlace | null;
  destinationPlace?: TimelinePlace | null;
  originLabel?: string | null;
  destinationLabel?: string | null;
  memberStates?: Record<string, "present" | "absent" | "partial" | "unknown">;
  [key: string]: unknown;
};

export type TimelineNode = {
  id: string;
  source: "itinerary" | "booking";
  nodeKind: "item" | "endpoint" | "anchor";
  title: string;
  dayId: string;
  sortOrder: number;
  place: TimelinePlace | null;
  itemId?: string;
  bookingId?: string;
  endpoint?: "origin" | "destination";
  anchorKind?: "start" | "stay" | "end";
  timeLocal?: string | null;
  memberStates?: Record<string, "present" | "absent" | "partial" | "unknown">;
  item?: TimelineItemInput;
  booking?: TimelineBookingInput;
};

export type TimelineEdge = {
  id: string;
  kind: "local" | "long-distance";
  dayId: string;
  from: TimelineNode;
  to: TimelineNode;
  bookingId?: string;
  crossCity: boolean;
};

export type DayTimelineAssembly = {
  dayId: string;
  nodes: TimelineNode[];
  edges: TimelineEdge[];
  localEdges: TimelineEdge[];
  longDistanceEdges: TimelineEdge[];
};

export function filterTimelineForMember(nodes: TimelineNode[], memberFilter: string) {
  return memberFilter === "all" ? nodes : nodes.filter((node) => node.memberStates?.[memberFilter] !== "absent");
}

/** One numbering rule for both Planning cards and Map markers. */
export function numberTimelineNodes(nodes: TimelineNode[]) {
  return new Map(nodes.filter((node) => node.nodeKind !== "anchor").map((node, index) => [node.id, index + 1]));
}

const longDistanceTypes = new Set(["flight", "train", "other"]);

function dayFromInstant(value: string | null | undefined, timezone?: string | null) {
  if (!value) return null;
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
      const year = parts.find((part) => part.type === "year")?.value;
      const month = parts.find((part) => part.type === "month")?.value;
      const day = parts.find((part) => part.type === "day")?.value;
      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // Fall through to the ISO date for malformed/unsupported timezones.
    }
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] || null;
}

function timeFromInstant(value: string | null | undefined, timezone?: string | null) {
  if (!value) return null;
  if (timezone) {
    try {
      return new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
    } catch {
      // Fall through to the ISO clock for malformed/unsupported timezones.
    }
  }
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] || null;
}

function endpointForDay(booking: TimelineBookingInput, dayId: string, date: string | null) {
  const startDate = booking.startDateLocal || dayFromInstant(booking.startAt, booking.timezone);
  const endDate = booking.endDateLocal || dayFromInstant(booking.endAt, booking.timezone) || startDate;
  if (!date) return { origin: true, destination: true, startDate, endDate };
  return { origin: startDate === date, destination: endDate === date, startDate, endDate };
}

function localMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60
    ? hours * 60 + minutes
    : null;
}

/**
 * Keep the display buckets explicit instead of using a single numeric sort
 * value.  In particular, an untimed destination endpoint must not sort ahead
 * of an untimed item simply because its synthetic sortOrder is large.
 */
function nodeBucket(node: TimelineNode) {
  if (node.nodeKind === "anchor") return node.anchorKind === "end" ? 5 : 0;
  if (node.timeLocal && localMinutes(node.timeLocal) != null) return 1;
  if (node.endpoint === "origin") return 2;
  if (node.endpoint === "destination") return 4;
  return 3;
}

function compareNodes(a: TimelineNode, b: TimelineNode) {
  const bucketDifference = nodeBucket(a) - nodeBucket(b);
  if (bucketDifference) return bucketDifference;
  if (nodeBucket(a) === 1) {
    // A long-distance Booking is an atomic edge. Sort both endpoints by the
    // departure time so another timed Item cannot be inserted between them.
    const timelineMinutes = (node: TimelineNode) => localMinutes(node.endpoint === "destination" ? timeFromInstant(node.booking?.startAt, node.booking?.timezone) : node.timeLocal);
    const timeDifference = (timelineMinutes(a) ?? Number.MAX_SAFE_INTEGER) - (timelineMinutes(b) ?? Number.MAX_SAFE_INTEGER);
    if (timeDifference) return timeDifference;
    if (a.bookingId || b.bookingId) {
      if (a.bookingId && b.bookingId) {
        const bookingDifference = a.bookingId.localeCompare(b.bookingId);
        if (bookingDifference) return bookingDifference;
        if (a.endpoint !== b.endpoint) return a.endpoint === "origin" ? -1 : 1;
      } else {
        return a.bookingId ? -1 : 1;
      }
    }
  }
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

/** Assemble one trip's deterministic timeline from persisted facts. */
export function assembleTimeline(input: {
  days: Array<{ id: string; date?: string | null; dayNumber?: number }>;
  items: TimelineItemInput[];
  bookings: TimelineBookingInput[];
}): Record<string, DayTimelineAssembly> {
  const result: Record<string, DayTimelineAssembly> = {};
  for (const day of input.days) {
    const nodes: TimelineNode[] = input.items
      .filter((item) => item.dayId === day.id)
      .map((item) => ({
        id: item.id,
        source: "itinerary",
        nodeKind: "item",
        title: item.title,
        dayId: day.id,
        sortOrder: item.sortOrder,
        place: item.place || null,
        itemId: item.id,
        timeLocal: item.startTimeLocal || null,
        memberStates: item.memberStates,
        item,
      }));

    for (const booking of input.bookings) {
      if (!longDistanceTypes.has(booking.type)) continue;
      const dates = endpointForDay(booking, day.id, day.date || null);
      if (dates.origin) nodes.push({
        id: `${booking.id}:origin`, source: "booking", nodeKind: "endpoint", endpoint: "origin",
        title: booking.originPlace?.name || booking.originLabel || "起点待确认", dayId: day.id,
        sortOrder: -100, place: booking.originPlace || null, bookingId: booking.id,
        timeLocal: timeFromInstant(booking.startAt, booking.timezone), memberStates: booking.memberStates, booking,
      });
      if (dates.destination) nodes.push({
        id: `${booking.id}:destination`, source: "booking", nodeKind: "endpoint", endpoint: "destination",
        title: booking.destinationPlace?.name || booking.destinationLabel || "终点待确认", dayId: day.id,
        sortOrder: 10000, place: booking.destinationPlace || null, bookingId: booking.id,
        timeLocal: timeFromInstant(booking.endAt, booking.timezone), memberStates: booking.memberStates, booking,
      });
    }

    nodes.sort(compareNodes);
    const longDistanceEdges: TimelineEdge[] = [];
    for (const booking of input.bookings) {
      if (!longDistanceTypes.has(booking.type)) continue;
      const from = nodes.find((node) => node.bookingId === booking.id && node.endpoint === "origin");
      const to = nodes.find((node) => node.bookingId === booking.id && node.endpoint === "destination");
      if (from && to) longDistanceEdges.push({ id: `${booking.id}:long-distance`, kind: "long-distance", dayId: day.id, from, to, bookingId: booking.id, crossCity: Boolean(from.place?.cityId && to.place?.cityId && from.place.cityId !== to.place.cityId) });
    }

    const localEdges: TimelineEdge[] = [];
    // Only concrete endpoint and ItineraryItem nodes participate in local
    // route inference. Accommodation bookings are deliberately absent from
    // this formal timeline; a hotel becomes a node only after the user adds a
    // Hotel Place as an ItineraryItem.
    const routeNodes = nodes;
    for (let index = 1; index < routeNodes.length; index += 1) {
      const from = routeNodes[index - 1], to = routeNodes[index];
      // A long-distance endpoint is a boundary. The item before an origin and
      // the item after a destination may route locally, but nothing may route
      // through the flight/train edge or across an unplaced item.
      if (from.endpoint === "origin" || to.endpoint === "destination") continue;
      if (!from.place || !to.place || from.place.latitude == null || from.place.longitude == null || to.place.latitude == null || to.place.longitude == null) continue;
      localEdges.push({ id: `${from.id}-${to.id}`, kind: "local", dayId: day.id, from, to, crossCity: Boolean(from.place.cityId && to.place.cityId && from.place.cityId !== to.place.cityId) });
    }
    result[day.id] = { dayId: day.id, nodes, edges: [...longDistanceEdges, ...localEdges], localEdges, longDistanceEdges };
  }
  return result;
}

export function assembleDayTimeline(input: { day: { id: string; date?: string | null }; items: TimelineItemInput[]; bookings: TimelineBookingInput[] }) {
  return assembleTimeline({ days: [input.day], items: input.items, bookings: input.bookings })[input.day.id];
}
