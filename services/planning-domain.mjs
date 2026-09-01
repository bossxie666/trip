const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const TIMEZONE_RE = /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+$/;

export function assertLocalDate(value, field = "date") {
  if (value != null) {
    if (!DATE_RE.test(value)) throw new Error(`INVALID_${field.toUpperCase()}`);
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

export function assertLocalTime(value, field = "time") {
  if (value != null && !TIME_RE.test(value)) throw new Error(`INVALID_${field.toUpperCase()}`);
}

export function assertUtcInstant(value, field = "instant") {
  if (value != null && (!UTC_RE.test(value) || Number.isNaN(Date.parse(value)))) throw new Error(`INVALID_${field.toUpperCase()}`);
}

export function assertTimezone(value) {
  if (value != null) {
    if (!TIMEZONE_RE.test(value)) throw new Error("INVALID_TIMEZONE");
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(0); } catch { throw new Error("INVALID_TIMEZONE"); }
  }
}

export function assertCurrency(value) {
  if (!CURRENCY_RE.test(value)) throw new Error("INVALID_CURRENCY");
}

export function assertMinorAmount(value, field = "amount") {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}

export function stableEqualSplit(amountMinor, memberIds) {
  assertMinorAmount(amountMinor);
  const ordered = [...new Set(memberIds)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  if (!ordered.length || ordered.length !== memberIds.length) throw new Error("INVALID_ALLOCATION_MEMBERS");
  const base = Math.floor(amountMinor / ordered.length);
  const remainder = amountMinor % ordered.length;
  return ordered.map((memberId, index) => ({ memberId, amountMinor: base + (index < remainder ? 1 : 0) }));
}

export function validateCustomAllocations(amountMinor, allocations) {
  assertMinorAmount(amountMinor);
  const ids = allocations.map((allocation) => allocation.memberId);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("INVALID_ALLOCATION_MEMBERS");
  for (const allocation of allocations) assertMinorAmount(allocation.amountMinor, "allocation");
  const total = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
  if (!Number.isSafeInteger(total) || total !== amountMinor) throw new Error("ALLOCATION_TOTAL_MISMATCH");
  return allocations.map((allocation) => ({ ...allocation }));
}

export function assertNoPresenceOverlap(existing, candidate, ignoreId = null) {
  const start = Date.parse(candidate.startsAt);
  const end = candidate.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(candidate.endsAt);
  if (!Number.isFinite(start) || end <= start) throw new Error("INVALID_PRESENCE_RANGE");
  const overlaps = existing.some((window) => {
    if (window.id === ignoreId) return false;
    const otherStart = Date.parse(window.startsAt);
    const otherEnd = window.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt);
    return start < otherEnd && otherStart < end;
  });
  if (overlaps) throw new Error("PRESENCE_OVERLAP");
}

export function resolvePresence(windows, at, coverage) {
  if (coverage !== "complete") return "unknown";
  const point = Date.parse(at);
  if (!Number.isFinite(point)) throw new Error("INVALID_PRESENCE_INSTANT");
  return windows.some((window) => {
    const start = Date.parse(window.startsAt);
    const end = window.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt);
    return start <= point && point < end;
  }) ? "present" : "absent";
}

function utcToLocalTime(instant, timezone) {
  if (!instant) return null;
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(instant));
}

export function buildDayTimeline({ dayDate, timezone, bookings, items, placements = [] }) {
  assertLocalDate(dayDate, "day_date");
  assertTimezone(timezone);
  const entries = [];
  for (const booking of bookings) {
    if (booking.temporalKind === "date_range") {
      if (booking.startDateLocal === dayDate) entries.push({ source: "booking", sourceId: booking.id, entryType: "booking-anchor", bucket: "start-of-day", title: booking.title, timeLocal: null, sortOrder: null, anchorKind: "start", locked: true });
      else if (booking.endDateLocal === dayDate) entries.push({ source: "booking", sourceId: booking.id, entryType: "booking-anchor", bucket: "end-of-day", title: booking.title, timeLocal: null, sortOrder: null, anchorKind: "end", locked: true });
      else if (booking.startDateLocal && booking.endDateLocal && booking.startDateLocal < dayDate && dayDate < booking.endDateLocal) entries.push({ source: "booking", sourceId: booking.id, entryType: "booking-anchor", bucket: "start-of-day", title: booking.title, timeLocal: null, sortOrder: null, anchorKind: "stay", locked: true });
      continue;
    }
    const localDate = booking.startAt ? new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(booking.startAt)) : null;
    if (localDate === dayDate) entries.push({ source: "booking", sourceId: booking.id, entryType: "booking-anchor", bucket: "timed", title: booking.title, timeLocal: utcToLocalTime(booking.startAt, timezone), endTimeLocal: utcToLocalTime(booking.endAt, timezone), timeMode: booking.endAt ? "range" : "start_only", sortOrder: null, anchorKind: "timed", locked: true });
  }
  for (const item of items) {
    const timeMode = item.timeMode || (item.startTimeLocal ? "start_only" : "untimed");
    const timed = timeMode === "start_only" || timeMode === "range";
    entries.push({ source: "itinerary", sourceId: item.id, entryType: "itinerary-item", bucket: timed ? "timed" : "untimed", title: item.title, timeLocal: item.startTimeLocal || null, endTimeLocal: item.endTimeLocal || null, timeMode, sortOrder: item.sortOrder, locked: item.lockedAt != null });
  }
  const bucketOrder = { "start-of-day": 0, timed: 1, untimed: 2, "end-of-day": 3 };
  const placementByKey = new Map((placements || []).map((placement) => [`${placement.sourceType === "itinerary_item" ? "itinerary" : "booking"}:${placement.sourceId}:${placement.anchorType || ""}`, placement.sortOrder]));
  for (const entry of entries) {
    const anchorTypes = entry.source === "itinerary" ? ["", "other"] : entry.anchorKind === "start" ? [entry.title.includes("酒店") ? "hotel_checkin" : "departure", "departure"] : entry.anchorKind === "end" ? [entry.title.includes("酒店") ? "hotel_checkout" : "arrival", "arrival"] : entry.anchorKind === "stay" ? ["stay"] : ["other"];
    entry.placementOrder = anchorTypes.map((anchorType) => placementByKey.get(`${entry.source}:${entry.sourceId}:${anchorType}`)).find((value) => value != null) ?? null;
  }
  return entries.sort((a, b) => {
    const aPlacement = a.placementOrder, bPlacement = b.placementOrder;
    if (aPlacement != null || bPlacement != null) {
      if (aPlacement == null) return 1;
      if (bPlacement == null) return -1;
      if (aPlacement !== bPlacement) return aPlacement - bPlacement;
    }
    const bucket = bucketOrder[a.bucket] - bucketOrder[b.bucket];
    if (bucket) return bucket;
    if (a.bucket === "timed") {
      const time = (a.timeLocal || "").localeCompare(b.timeLocal || "");
      if (time) return time;
      if (a.source !== b.source) return a.source === "booking" ? -1 : 1;
    }
    if (a.bucket === "untimed") {
      const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (order) return order;
    }
    return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
  });
}
