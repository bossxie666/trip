import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import {
  bookingCostAllocationRecords,
  bookingCostLineRecords,
  bookingParticipantRecords,
  bookingRecords,
  dayRecords,
  dayPresenceRecords,
  expenseAllocationRecords,
  expenseRecords,
  itineraryItemParticipantOverrideRecords,
  itineraryItemRecords,
  memberBudgetPlanRecords,
  memberRecords,
  recommendationRecords,
  tripMemberRecords,
  tripRecords,
} from "@/db/schema";
import { assertCurrency, assertLocalDate, assertMinorAmount, assertUtcInstant, stableEqualSplit, validateCustomAllocations } from "./planning-domain.mjs";
import type { BudgetCategory, ExpenseScope, MoneyAllocation } from "@/models/planning";

export const budgetCategories: BudgetCategory[] = ["food", "local_transport", "entertainment", "shopping", "other"];

const isBudgetCategory = (value: unknown): value is BudgetCategory => typeof value === "string" && budgetCategories.includes(value as BudgetCategory);

type BudgetPlanRow = typeof memberBudgetPlanRecords.$inferSelect;
type ExpenseRow = typeof expenseRecords.$inferSelect;

export type PersonalBudgetWorkspace = {
  memberId: string;
  plans: BudgetPlanRow[];
  bookings: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    totalAmountMinor: number | null;
    currency: string | null;
    ownAmountMinor: number | null;
    pending: boolean;
    participants: Array<{ memberId: string; displayName: string }>;
    costLines: Array<{ id: string; title: string; amountMinor: number; currency: string; allocationMode: "equal" | "custom"; allocations: MoneyAllocation[] }>;
  }>;
  expenses: Array<ExpenseRow & { ownAmountMinor: number | null; payerName: string | null }>;
  totals: {
    fixedPersonalMinor: number;
    plannedMinor: number;
    actualMinor: number;
    expectedMinor: number;
    confirmedMinor: number;
    remainingMinor: number;
    estimatedRecommendationMinor: number;
    estimatedTransportMinor: number;
  };
  expectedUnknownCount: number;
};

function inputError(code: string): never { throw new Error(code); }

async function getTripAndMember(slug: string, memberId: string) {
  const db = getDb();
  const trip = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) inputError("TRIP_NOT_FOUND");
  const membership = (await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, memberId))).limit(1))[0];
  if (!membership) inputError("TRIP_MEMBER_REQUIRED");
  return trip;
}

export async function getPersonalBudgetWorkspace(slug: string, memberId: string): Promise<PersonalBudgetWorkspace> {
  const trip = await getTripAndMember(slug, memberId);
  const db = getDb();
  const [plans, bookings, allocations, expenses, expenseAllocations, members, bookingParticipants, costLines, itineraryRows, itemOverrides, dayPresence] = await Promise.all([
    db.select().from(memberBudgetPlanRecords).where(and(eq(memberBudgetPlanRecords.tripId, trip.id), eq(memberBudgetPlanRecords.memberId, memberId))).orderBy(asc(memberBudgetPlanRecords.category)),
    db.select().from(bookingRecords).where(and(eq(bookingRecords.tripId, trip.id), eq(bookingRecords.status, "confirmed"), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingRecords.startAt), asc(bookingRecords.startDateLocal), asc(bookingRecords.id)),
    db.select().from(bookingCostAllocationRecords).innerJoin(bookingCostLineRecords, eq(bookingCostLineRecords.id, bookingCostAllocationRecords.costLineId)).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt))),
    db.select().from(expenseRecords).where(and(eq(expenseRecords.tripId, trip.id), isNull(expenseRecords.deletedAt))).orderBy(desc(expenseRecords.occurredDate), desc(expenseRecords.createdAt)),
    db.select().from(expenseAllocationRecords).innerJoin(expenseRecords, eq(expenseRecords.id, expenseAllocationRecords.expenseId)).where(and(eq(expenseRecords.tripId, trip.id), isNull(expenseRecords.deletedAt))),
    db.select({ id: memberRecords.id, displayName: memberRecords.displayName }).from(memberRecords),
    db.select().from(bookingParticipantRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingParticipantRecords.bookingId)).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt))),
    db.select({ line: bookingCostLineRecords, allocation: bookingCostAllocationRecords }).from(bookingCostLineRecords).innerJoin(bookingRecords, eq(bookingRecords.id, bookingCostLineRecords.bookingId)).leftJoin(bookingCostAllocationRecords, eq(bookingCostAllocationRecords.costLineId, bookingCostLineRecords.id)).where(and(eq(bookingRecords.tripId, trip.id), isNull(bookingRecords.deletedAt))).orderBy(asc(bookingCostLineRecords.sortOrder)),
    db.select({ item: itineraryItemRecords, recommendation: recommendationRecords }).from(itineraryItemRecords).leftJoin(recommendationRecords, eq(recommendationRecords.id, itineraryItemRecords.recommendationId)).where(eq(itineraryItemRecords.tripId, trip.id)),
    db.select().from(itineraryItemParticipantOverrideRecords).innerJoin(itineraryItemRecords, eq(itineraryItemRecords.id, itineraryItemParticipantOverrideRecords.itineraryItemId)).where(eq(itineraryItemRecords.tripId, trip.id)),
    db.select().from(dayPresenceRecords).where(eq(dayPresenceRecords.tripId, trip.id)),
  ]);

  const ownBookingAmounts = new Map<string, number>();
  const bookingHasOwnAllocation = new Set<string>();
  for (const row of allocations) {
    if (row.booking_cost_allocations.memberId !== memberId) continue;
    const bookingId = row.bookings.id;
    ownBookingAmounts.set(bookingId, (ownBookingAmounts.get(bookingId) || 0) + row.booking_cost_allocations.amountMinor);
    bookingHasOwnAllocation.add(bookingId);
  }
  const memberNames = new Map(members.map((member) => [member.id, member.displayName]));
  const participantsByBooking = new Map<string, Array<{ memberId: string; displayName: string }>>();
  for (const row of bookingParticipants) {
    const participant = row.booking_participants;
    const list = participantsByBooking.get(participant.bookingId) || [];
    list.push({ memberId: participant.memberId, displayName: memberNames.get(participant.memberId) || participant.memberId });
    participantsByBooking.set(participant.bookingId, list);
  }
  const costLinesByBooking = new Map<string, Array<{ id: string; title: string; amountMinor: number; currency: string; allocationMode: "equal" | "custom"; allocations: MoneyAllocation[] }>>();
  for (const row of costLines) {
    const line = row.line;
    const list = costLinesByBooking.get(line.bookingId) || [];
    const existing = list.find((candidate) => candidate.id === line.id);
    if (!existing) {
      list.push({ id: line.id, title: line.title, amountMinor: line.amountMinor, currency: line.currency, allocationMode: line.allocationMode, allocations: [] });
    }
    if (row.allocation) list.find((candidate) => candidate.id === line.id)?.allocations.push({ memberId: row.allocation.memberId, amountMinor: row.allocation.amountMinor, notes: row.allocation.notes });
    costLinesByBooking.set(line.bookingId, list);
  }
  const bookingView = bookings.map((booking) => {
    const ownAmountMinor = bookingHasOwnAllocation.has(booking.id) ? ownBookingAmounts.get(booking.id) || 0 : null;
    return { id: booking.id, title: booking.title, type: booking.type, status: booking.status, totalAmountMinor: booking.totalAmountMinor, currency: booking.currency, ownAmountMinor, pending: ownAmountMinor == null, participants: participantsByBooking.get(booking.id) || [], costLines: costLinesByBooking.get(booking.id) || [] };
  });

  const ownExpenses = new Map<string, number>();
  for (const row of expenseAllocations) {
    if (row.expense_allocations.memberId === memberId) ownExpenses.set(row.expenses.id, row.expense_allocations.amountMinor);
  }
  const expenseView = expenses
    .filter((expense) => expense.scope === "shared" ? ownExpenses.has(expense.id) || expense.createdByMemberId === memberId : expense.createdByMemberId === memberId)
    .map((expense) => ({ ...expense, ownAmountMinor: expense.scope === "personal" ? expense.amountMinor : ownExpenses.get(expense.id) ?? null, payerName: expense.paidByMemberId ? memberNames.get(expense.paidByMemberId) || null : null }));

  const fixedPersonalMinor = bookingView.reduce((sum, booking) => sum + (booking.ownAmountMinor ?? 0), 0);
  const plannedMinor = plans.reduce((sum, plan) => sum + plan.plannedAmountMinor, 0);
  const actualMinor = expenseView.reduce((sum, expense) => sum + (expense.ownAmountMinor ?? 0), 0);
  let estimatedRecommendationMinor = 0;
  let expectedUnknownCount = 0;
  for (const row of itineraryRows) {
    const recommendation = row.recommendation;
    if (!recommendation || recommendation.deletedAt) continue;
    const override = itemOverrides.find(({ itinerary_item_participant_overrides: entry }) => entry.itineraryItemId === row.item.id && entry.memberId === memberId)?.itinerary_item_participant_overrides;
    const presence = dayPresence.find((entry) => entry.dayId === row.item.dayId && entry.memberId === memberId);
    const included = override?.participation === "included" || (!override && presence?.state === "present");
    const excluded = override?.participation === "excluded" || (!override && presence?.state === "absent");
    if (excluded) continue;
    if (!included) { expectedUnknownCount += 1; continue; }
    const basis = recommendation.priceBasis || (recommendation.estimatedCostMinor != null ? "per_person" : "unknown");
    const amount = recommendation.priceMinMinor ?? recommendation.estimatedCostMinor;
    if (basis === "free") continue;
    if ((basis === "per_person" || basis === "per_item") && amount != null) { estimatedRecommendationMinor += amount; continue; }
    if (basis === "per_group" && amount != null) {
      const knownMembers = dayPresence.filter((entry) => entry.dayId === row.item.dayId && entry.state === "present").length;
      if (knownMembers > 0) { estimatedRecommendationMinor += Math.ceil(amount / knownMembers); continue; }
    }
    expectedUnknownCount += 1;
  }
  const estimatedTransportMinor = 0;
  return {
    memberId,
    plans,
    bookings: bookingView,
    expenses: expenseView,
    totals: {
      fixedPersonalMinor,
      plannedMinor,
      actualMinor,
      expectedMinor: fixedPersonalMinor + plannedMinor + estimatedRecommendationMinor + estimatedTransportMinor,
      confirmedMinor: fixedPersonalMinor + actualMinor,
      remainingMinor: plannedMinor - actualMinor,
      estimatedRecommendationMinor,
      estimatedTransportMinor,
    },
    expectedUnknownCount,
  };
}

export async function upsertMemberBudgetPlan(slug: string, memberId: string, input: { category: BudgetCategory; plannedAmountMinor: number; currency?: string }) {
  const trip = await getTripAndMember(slug, memberId);
  if (!isBudgetCategory(input.category)) inputError("INVALID_BUDGET_CATEGORY");
  assertMinorAmount(input.plannedAmountMinor, "planned_amount");
  const currency = input.currency || "CNY";
  assertCurrency(currency);
  const now = new Date().toISOString();
  const db = getRuntimeEnv().DB;
  await db.prepare("INSERT INTO member_budget_plans (id, trip_id, member_id, category, planned_amount_minor, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (trip_id, member_id, category) DO UPDATE SET planned_amount_minor = excluded.planned_amount_minor, currency = excluded.currency, updated_at = excluded.updated_at").bind(crypto.randomUUID(), trip.id, memberId, input.category, input.plannedAmountMinor, currency, now, now).run();
  return (await getDb().select().from(memberBudgetPlanRecords).where(and(eq(memberBudgetPlanRecords.tripId, trip.id), eq(memberBudgetPlanRecords.memberId, memberId), eq(memberBudgetPlanRecords.category, input.category))).limit(1))[0];
}

export type CreateExpenseInput = {
  title: string;
  category: BudgetCategory;
  amountMinor: number;
  currency?: string;
  scope: ExpenseScope;
  dayId?: string | null;
  paidByMemberId?: string | null;
  allocations?: MoneyAllocation[];
  participantMemberIds?: string[];
  notes?: string | null;
  occurredAt?: string | null;
  occurredDate?: string | null;
};

async function validateExpenseInput(tripId: string, input: CreateExpenseInput) {
  if (!input.title?.trim()) inputError("EXPENSE_TITLE_REQUIRED");
  if (!isBudgetCategory(input.category)) inputError("INVALID_EXPENSE_CATEGORY");
  assertMinorAmount(input.amountMinor, "expense_amount");
  if (input.amountMinor <= 0) inputError("EXPENSE_AMOUNT_REQUIRED");
  const currency = input.currency || "CNY";
  assertCurrency(currency);
  if (input.scope !== "personal" && input.scope !== "shared") inputError("INVALID_EXPENSE_SCOPE");
  assertUtcInstant(input.occurredAt ?? null, "occurred_at");
  assertLocalDate(input.occurredDate ?? null, "occurred_date");
  const db = getDb();
  if (input.dayId) {
    const day = (await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, tripId))).limit(1))[0];
    if (!day) inputError("DAY_NOT_IN_TRIP");
  }
  const tripMembers = await db.select({ id: tripMemberRecords.memberId }).from(tripMemberRecords).where(eq(tripMemberRecords.tripId, tripId));
  const allowed = new Set(tripMembers.map((member) => member.id));
  const payer = input.paidByMemberId || null;
  if (payer && !allowed.has(payer)) inputError("EXPENSE_PAYER_NOT_IN_TRIP");
  return { currency, allowed };
}

function buildExpenseAllocations(input: CreateExpenseInput, actorMemberId: string, allowed: Set<string>) {
  if (input.scope === "personal") return [{ memberId: actorMemberId, amountMinor: input.amountMinor }];
  const requested = input.allocations?.length ? input.allocations : (input.participantMemberIds || []).map((memberId) => ({ memberId, amountMinor: 0 }));
  if (!requested.length) inputError("EXPENSE_PARTICIPANTS_REQUIRED");
  for (const allocation of requested) if (!allowed.has(allocation.memberId)) inputError("EXPENSE_MEMBER_NOT_IN_TRIP");
  if (input.allocations?.length) return validateCustomAllocations(input.amountMinor, requested);
  return stableEqualSplit(input.amountMinor, requested.map((allocation) => allocation.memberId));
}

export async function createExpense(slug: string, actorMemberId: string, input: CreateExpenseInput) {
  const trip = await getTripAndMember(slug, actorMemberId);
  const { currency, allowed } = await validateExpenseInput(trip.id, input);
  const allocations = buildExpenseAllocations(input, actorMemberId, allowed);
  const id = crypto.randomUUID(), now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
  const statements = [d1.prepare("INSERT INTO expenses (id, trip_id, day_id, title, category, amount_minor, currency, scope, paid_by_member_id, created_by_member_id, notes, occurred_at, occurred_date, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)").bind(id, trip.id, input.dayId ?? null, input.title.trim(), input.category, input.amountMinor, currency, input.scope, input.paidByMemberId ?? (input.scope === "personal" ? actorMemberId : null), actorMemberId, input.notes ?? null, input.occurredAt ?? null, input.occurredDate ?? null, now, now)];
  for (const allocation of allocations) statements.push(d1.prepare("INSERT INTO expense_allocations (id, expense_id, member_id, amount_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, allocation.memberId, allocation.amountMinor, now, now));
  await d1.batch(statements);
  return (await getDb().select().from(expenseRecords).where(eq(expenseRecords.id, id)).limit(1))[0];
}

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, "scope">> & { allocations?: MoneyAllocation[]; participantMemberIds?: string[] };

export async function updateExpense(slug: string, actorMemberId: string, expenseId: string, input: UpdateExpenseInput) {
  const trip = await getTripAndMember(slug, actorMemberId);
  const db = getDb();
  const expense = (await db.select().from(expenseRecords).where(and(eq(expenseRecords.id, expenseId), eq(expenseRecords.tripId, trip.id), isNull(expenseRecords.deletedAt))).limit(1))[0];
  if (!expense) inputError("EXPENSE_NOT_FOUND");
  if (expense.scope === "personal" && expense.createdByMemberId !== actorMemberId) inputError("EXPENSE_OWNER_REQUIRED");
  const title = input.title == null ? expense.title : input.title.trim();
  if (!title) inputError("EXPENSE_TITLE_REQUIRED");
  const category = input.category || expense.category;
  if (!isBudgetCategory(category)) inputError("INVALID_EXPENSE_CATEGORY");
  const amountMinor = input.amountMinor == null ? expense.amountMinor : input.amountMinor;
  assertMinorAmount(amountMinor, "expense_amount");
  if (amountMinor <= 0) inputError("EXPENSE_AMOUNT_REQUIRED");
  const currency = input.currency || expense.currency;
  assertCurrency(currency);
  assertUtcInstant(input.occurredAt ?? expense.occurredAt, "occurred_at");
  assertLocalDate(input.occurredDate ?? expense.occurredDate, "occurred_date");
  if (input.dayId) {
    const day = (await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, trip.id))).limit(1))[0];
    if (!day) inputError("DAY_NOT_IN_TRIP");
  }
  const amountChanged = amountMinor !== expense.amountMinor;
  let allocations: MoneyAllocation[] | null = null;
  if (amountChanged || input.allocations || input.participantMemberIds) {
    const members = await db.select({ id: tripMemberRecords.memberId }).from(tripMemberRecords).where(eq(tripMemberRecords.tripId, trip.id));
    const allowed = new Set(members.map((member) => member.id));
    allocations = buildExpenseAllocations({ title, category, amountMinor, currency, scope: expense.scope, dayId: input.dayId ?? expense.dayId, paidByMemberId: input.paidByMemberId ?? expense.paidByMemberId, allocations: input.allocations, participantMemberIds: input.participantMemberIds, notes: input.notes ?? expense.notes, occurredAt: input.occurredAt ?? expense.occurredAt, occurredDate: input.occurredDate ?? expense.occurredDate }, actorMemberId, allowed);
  }
  const now = new Date().toISOString(), d1 = getRuntimeEnv().DB;
  const statements = [d1.prepare("UPDATE expenses SET day_id = ?, title = ?, category = ?, amount_minor = ?, currency = ?, paid_by_member_id = ?, notes = ?, occurred_at = ?, occurred_date = ?, updated_at = ? WHERE id = ? AND trip_id = ?").bind(input.dayId === undefined ? expense.dayId : input.dayId, title, category, amountMinor, currency, input.paidByMemberId === undefined ? expense.paidByMemberId : input.paidByMemberId, input.notes === undefined ? expense.notes : input.notes, input.occurredAt === undefined ? expense.occurredAt : input.occurredAt, input.occurredDate === undefined ? expense.occurredDate : input.occurredDate, now, expenseId, trip.id)];
  if (allocations) {
    statements.push(d1.prepare("DELETE FROM expense_allocations WHERE expense_id = ?").bind(expenseId));
    for (const allocation of allocations) statements.push(d1.prepare("INSERT INTO expense_allocations (id, expense_id, member_id, amount_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), expenseId, allocation.memberId, allocation.amountMinor, now, now));
  }
  await d1.batch(statements);
  return (await db.select().from(expenseRecords).where(eq(expenseRecords.id, expenseId)).limit(1))[0];
}

export async function deleteExpense(slug: string, actorMemberId: string, expenseId: string) {
  const trip = await getTripAndMember(slug, actorMemberId);
  const db = getDb();
  const expense = (await db.select().from(expenseRecords).where(and(eq(expenseRecords.id, expenseId), eq(expenseRecords.tripId, trip.id), isNull(expenseRecords.deletedAt))).limit(1))[0];
  if (!expense) inputError("EXPENSE_NOT_FOUND");
  if (expense.scope === "personal" && expense.createdByMemberId !== actorMemberId) inputError("EXPENSE_OWNER_REQUIRED");
  await db.update(expenseRecords).set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(expenseRecords.id, expenseId));
  return true;
}
