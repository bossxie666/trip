import type { DayTimelineEntry, MoneyAllocation, PresenceCoverage, PresenceState, PresenceWindow, TimelineBooking, TimelineItineraryItem } from "../models/planning.ts";

export function assertLocalDate(value: string | null | undefined, field?: string): void;
export function assertLocalTime(value: string | null | undefined, field?: string): void;
export function assertUtcInstant(value: string | null | undefined, field?: string): void;
export function assertTimezone(value: string | null | undefined): void;
export function assertCurrency(value: string): void;
export function assertMinorAmount(value: number, field?: string): void;
export function stableEqualSplit(amountMinor: number, memberIds: string[]): MoneyAllocation[];
export function validateCustomAllocations(amountMinor: number, allocations: MoneyAllocation[]): MoneyAllocation[];
export function assertNoPresenceOverlap(existing: PresenceWindow[], candidate: Omit<PresenceWindow, "id">, ignoreId?: string | null): void;
export function resolvePresence(windows: PresenceWindow[], at: string, coverage: PresenceCoverage): PresenceState;
export function buildDayTimeline(input: { dayDate: string; timezone: string; bookings: TimelineBooking[]; items: TimelineItineraryItem[] }): DayTimelineEntry[];
