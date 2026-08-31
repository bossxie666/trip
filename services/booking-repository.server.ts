import { and, eq, inArray } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "../db/index.ts";
import { bookingCostAllocationRecords, bookingCostLineRecords, bookingRecords, placeRecords, tripCityRecords, tripMemberRecords, tripRecords } from "../db/schema.ts";
import { assertCurrency, assertLocalDate, assertMinorAmount, assertTimezone, assertUtcInstant, stableEqualSplit, validateCustomAllocations } from "./planning-domain.mjs";
import type { AllocationMode, BookingStatus, BookingTemporalKind, BookingType, MoneyAllocation } from "../models/planning.ts";

export type CreateBookingInput = {
  tripId: string;
  type: BookingType;
  status: BookingStatus;
  title: string;
  temporalKind: BookingTemporalKind;
  provider?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  startDateLocal?: string | null;
  endDateLocal?: string | null;
  timezone?: string | null;
  placeId?: string | null;
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  totalAmountMinor?: number | null;
  currency?: string | null;
  bookingReference?: string | null;
  notes?: string | null;
  protected?: boolean;
  participantMemberIds?: string[];
};

function validateBookingTime(input: CreateBookingInput) {
  assertUtcInstant(input.startAt ?? null, "start_at"); assertUtcInstant(input.endAt ?? null, "end_at");
  assertLocalDate(input.startDateLocal ?? null, "start_date"); assertLocalDate(input.endDateLocal ?? null, "end_date");
  assertTimezone(input.timezone ?? null);
  if (input.temporalKind === "date_range" && (!input.startDateLocal || !input.endDateLocal)) throw new Error("BOOKING_DATE_RANGE_REQUIRED");
  if (input.temporalKind !== "date_range" && !input.startAt) throw new Error("BOOKING_START_AT_REQUIRED");
  if (input.endAt && input.startAt && Date.parse(input.endAt) <= Date.parse(input.startAt)) throw new Error("INVALID_BOOKING_RANGE");
  if (input.endDateLocal && input.startDateLocal && input.endDateLocal < input.startDateLocal) throw new Error("INVALID_BOOKING_DATE_RANGE");
}

export async function createBooking(input: CreateBookingInput, actorMemberId: string) {
  if (!input.title.trim()) throw new Error("BOOKING_TITLE_REQUIRED");
  validateBookingTime(input);
  if (input.totalAmountMinor != null) assertMinorAmount(input.totalAmountMinor, "total_amount");
  if (input.currency != null) assertCurrency(input.currency);
  if ((input.totalAmountMinor == null) !== (input.currency == null)) throw new Error("BOOKING_MONEY_INCOMPLETE");
  const db = getDb();
  if (!(await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.id, input.tripId)).limit(1))[0]) throw new Error("TRIP_NOT_FOUND");
  const participants = [...new Set(input.participantMemberIds ?? [])];
  if (participants.length) {
    const valid = await db.select({ id: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, input.tripId), inArray(tripMemberRecords.memberId, participants)));
    if (valid.length !== participants.length) throw new Error("BOOKING_PARTICIPANT_NOT_IN_TRIP");
  }
  const placeIds = [...new Set([input.placeId, input.originPlaceId, input.destinationPlaceId].filter((id): id is string => Boolean(id)))];
  if (placeIds.length) {
    const valid = await db.select({ id: placeRecords.id }).from(placeRecords).innerJoin(tripCityRecords, and(eq(tripCityRecords.cityId, placeRecords.cityId), eq(tripCityRecords.tripId, input.tripId))).where(inArray(placeRecords.id, placeIds));
    if (valid.length !== placeIds.length) throw new Error("BOOKING_PLACE_NOT_IN_TRIP_CITY");
  }
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const d1 = getRuntimeEnv().DB;
  const statements = [d1.prepare("INSERT INTO bookings (id, trip_id, type, status, title, provider, temporal_kind, start_at, end_at, start_date_local, end_date_local, timezone, place_id, origin_place_id, destination_place_id, total_amount_minor, currency, booking_reference, notes, protected, created_by_member_id, updated_by_member_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)").bind(id, input.tripId, input.type, input.status, input.title.trim(), input.provider ?? null, input.temporalKind, input.startAt ?? null, input.endAt ?? null, input.startDateLocal ?? null, input.endDateLocal ?? null, input.timezone ?? null, input.placeId ?? null, input.originPlaceId ?? null, input.destinationPlaceId ?? null, input.totalAmountMinor ?? null, input.currency ?? null, input.bookingReference ?? null, input.notes ?? null, input.protected ? 1 : 0, actorMemberId, actorMemberId, now, now)];
  for (const memberId of participants) statements.push(d1.prepare("INSERT INTO booking_participants (booking_id, member_id, role, created_at) VALUES (?, ?, 'covered', ?)").bind(id, memberId, now));
  await d1.batch(statements);
  return (await db.select().from(bookingRecords).where(eq(bookingRecords.id, id)).limit(1))[0];
}

export async function createBookingCostLine(input: { bookingId: string; title: string; serviceStartDate?: string | null; serviceEndDate?: string | null; amountMinor: number; currency: string; allocationMode: AllocationMode; sortOrder: number; notes?: string | null }) {
  assertMinorAmount(input.amountMinor); assertCurrency(input.currency); assertLocalDate(input.serviceStartDate ?? null); assertLocalDate(input.serviceEndDate ?? null);
  if (input.serviceStartDate && input.serviceEndDate && input.serviceEndDate < input.serviceStartDate) throw new Error("INVALID_COST_LINE_DATE_RANGE");
  if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0) throw new Error("INVALID_SORT_ORDER");
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await getDb().insert(bookingCostLineRecords).values({ id, ...input, serviceStartDate: input.serviceStartDate ?? null, serviceEndDate: input.serviceEndDate ?? null, notes: input.notes ?? null, createdAt: now, updatedAt: now });
  return (await getDb().select().from(bookingCostLineRecords).where(eq(bookingCostLineRecords.id, id)).limit(1))[0];
}

export async function replaceCostAllocations(costLineId: string, allocationsOrMemberIds: MoneyAllocation[] | string[]) {
  const db = getDb();
  const line = (await db.select({ line: bookingCostLineRecords, tripId: bookingRecords.tripId }).from(bookingCostLineRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).where(eq(bookingCostLineRecords.id, costLineId)).limit(1))[0];
  if (!line) throw new Error("COST_LINE_NOT_FOUND");
  if (line.line.allocationMode === "equal" && !allocationsOrMemberIds.every((value) => typeof value === "string")) throw new Error("INVALID_EQUAL_ALLOCATION_INPUT");
  if (line.line.allocationMode === "custom" && !allocationsOrMemberIds.every((value) => typeof value === "object" && value !== null && "memberId" in value && "amountMinor" in value)) throw new Error("INVALID_CUSTOM_ALLOCATION_INPUT");
  const allocations: MoneyAllocation[] = line.line.allocationMode === "equal"
    ? stableEqualSplit(line.line.amountMinor, allocationsOrMemberIds as string[])
    : validateCustomAllocations(line.line.amountMinor, allocationsOrMemberIds as MoneyAllocation[]);
  const memberIds = allocations.map((allocation) => allocation.memberId);
  const valid = await db.select({ id: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, line.tripId), inArray(tripMemberRecords.memberId, memberIds)));
  if (valid.length !== memberIds.length) throw new Error("ALLOCATION_MEMBER_NOT_IN_TRIP");
  const now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
  const statements = [d1.prepare("DELETE FROM booking_cost_allocations WHERE cost_line_id = ?").bind(costLineId)];
  for (const allocation of allocations) statements.push(d1.prepare("INSERT INTO booking_cost_allocations (id, cost_line_id, member_id, amount_minor, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), costLineId, allocation.memberId, allocation.amountMinor, allocation.notes ?? null, now, now));
  await d1.batch(statements);
  return db.select().from(bookingCostAllocationRecords).where(eq(bookingCostAllocationRecords.costLineId, costLineId));
}

export async function deleteBooking(id: string, options: { hard?: boolean } = {}) {
  const db = getDb();
  const booking = (await db.select().from(bookingRecords).where(eq(bookingRecords.id, id)).limit(1))[0];
  if (!booking) return false;
  if (options.hard && (booking.status === "confirmed" || booking.protected)) throw new Error("BOOKING_HARD_DELETE_PROTECTED");
  if (options.hard) await db.delete(bookingRecords).where(eq(bookingRecords.id, id));
  else await db.update(bookingRecords).set({ deletedAt: new Date().toISOString(), status: "cancelled", updatedAt: new Date().toISOString() }).where(eq(bookingRecords.id, id));
  return true;
}
