import { and, eq } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { bookingRecords, dayRecords, frameworkConstraintRecords, tripRecords, tripStageRecords } from "../db/schema.ts";
import { assertUtcInstant } from "./planning-domain.mjs";
import type { ConstraintStrength } from "../models/planning.ts";

export async function createFrameworkConstraint(input: { tripId: string; dayId?: string | null; stageId?: string | null; bookingId?: string | null; constraintType: string; title: string; description?: string | null; strength: ConstraintStrength; startsAt?: string | null; endsAt?: string | null }, actorMemberId: string) {
  if (!input.title.trim() || !input.constraintType.trim()) throw new Error("CONSTRAINT_FIELDS_REQUIRED");
  assertUtcInstant(input.startsAt ?? null, "starts_at"); assertUtcInstant(input.endsAt ?? null, "ends_at");
  if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new Error("INVALID_CONSTRAINT_RANGE");
  const db = getDb();
  if (!(await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.id, input.tripId)).limit(1))[0]) throw new Error("TRIP_NOT_FOUND");
  if (input.dayId && !(await db.select({ id: dayRecords.id }).from(dayRecords).where(and(eq(dayRecords.id, input.dayId), eq(dayRecords.tripId, input.tripId))).limit(1))[0]) throw new Error("DAY_NOT_IN_TRIP");
  if (input.stageId && !(await db.select({ id: tripStageRecords.id }).from(tripStageRecords).where(and(eq(tripStageRecords.id, input.stageId), eq(tripStageRecords.tripId, input.tripId))).limit(1))[0]) throw new Error("STAGE_NOT_IN_TRIP");
  if (input.bookingId && !(await db.select({ id: bookingRecords.id }).from(bookingRecords).where(and(eq(bookingRecords.id, input.bookingId), eq(bookingRecords.tripId, input.tripId))).limit(1))[0]) throw new Error("BOOKING_NOT_IN_TRIP");
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db.insert(frameworkConstraintRecords).values({ id, ...input, title: input.title.trim(), constraintType: input.constraintType.trim(), dayId: input.dayId ?? null, stageId: input.stageId ?? null, bookingId: input.bookingId ?? null, description: input.description ?? null, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, createdByMemberId: actorMemberId, updatedByMemberId: actorMemberId, createdAt: now, updatedAt: now, deletedAt: null });
  return id;
}
