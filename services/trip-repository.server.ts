import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { cityRecords, dayPlaceRecords, dayRecords, memberRecords, tripCityRecords, tripMemberRecords, tripRecords, tripStageMemberRecords, tripStageRecords } from "@/db/schema";
import { getTripBySlug as getSeedTripBySlug, trips as seedTrips } from "@/data/trips";
import type { Day, Trip, TripStatus } from "@/models/travel";

export type CreateTripInput = {
  title: string;
  status: Extract<TripStatus, "inspiration" | "planning">;
  cities?: string[];
  startDate: string | null;
  endDate: string | null;
  people: number;
  cover: string | null;
  memberIds: string[];
};

export type UpdateTripInput = Omit<CreateTripInput, "status"> & { status: TripStatus };

function normalizeCityNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

/**
 * Seed records are useful for local fixtures, but a production D1 must never
 * silently be supplemented by stale static planning data.  The Sites runtime
 * always exposes DB, while tests can opt into the same behaviour by providing
 * the in-memory D1 binding.  A seed fallback is therefore only available when
 * no database binding exists (or when an explicit development flag enables it).
 */
function seedFallbackAllowed() {
  const env = getRuntimeEnv() as { DB?: unknown; TRIP_ALLOW_SEED_FALLBACK?: string };
  return !env.DB || env.TRIP_ALLOW_SEED_FALLBACK === "true";
}

export function createStableSlugBase(title: string, startDate: string | null, id: string) {
  const asciiTitle = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const year = startDate?.slice(0, 4) || "undated";
  return asciiTitle.length >= 3
    ? `${asciiTitle}-${year}`
    : `trip-${year}-${id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

function generateDays(tripId: string, startDate: string | null, endDate: string | null): Day[] {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days: Day[] = [];
  for (let cursor = start, number = 1; cursor <= end && number <= 366; number += 1) {
    days.push({
      id: `${tripId}-day-${number}`,
      tripId,
      date: cursor.toISOString().slice(0, 10),
      title: `Day ${number}`,
      updatedAt: null,
      placeIds: [],
    });
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return days;
}

async function hydrateTrips(rows: (typeof tripRecords.$inferSelect)[]): Promise<Trip[]> {
  if (!rows.length) return [];
  const db = getDb();
  const tripIds = rows.map((row) => row.id);
  const cityLinks = await db
    .select({ tripId: tripCityRecords.tripId, id: cityRecords.id, slug: cityRecords.slug, name: cityRecords.name })
    .from(tripCityRecords)
    .innerJoin(cityRecords, eq(tripCityRecords.cityId, cityRecords.id))
    .where(inArray(tripCityRecords.tripId, tripIds))
    .orderBy(asc(tripCityRecords.position));
  const stageLinks = await db
    .select({
      tripId: tripStageRecords.tripId,
      id: tripStageRecords.id,
      cityId: tripStageRecords.cityId,
      citySlug: cityRecords.slug,
      cityName: cityRecords.name,
      title: tripStageRecords.title,
      sortOrder: tripStageRecords.sortOrder,
      createdAt: tripStageRecords.createdAt,
      updatedAt: tripStageRecords.updatedAt,
    })
    .from(tripStageRecords)
    .innerJoin(cityRecords, eq(tripStageRecords.cityId, cityRecords.id))
    .where(inArray(tripStageRecords.tripId, tripIds))
    .orderBy(asc(tripStageRecords.sortOrder));
  const stageIds = stageLinks.map((stage) => stage.id);
  const stageMemberLinks = stageIds.length
    ? await db.select({ stageId: tripStageMemberRecords.stageId, id: memberRecords.id, name: memberRecords.name, displayName: memberRecords.displayName, avatar: memberRecords.avatar, active: memberRecords.active, createdAt: memberRecords.createdAt })
      .from(tripStageMemberRecords)
      .innerJoin(memberRecords, eq(tripStageMemberRecords.memberId, memberRecords.id))
      .where(inArray(tripStageMemberRecords.stageId, stageIds))
    : [];
  const storedDays = await db
    .select()
    .from(dayRecords)
    .where(inArray(dayRecords.tripId, tripIds))
    .orderBy(asc(dayRecords.dayNumber));
  const storedDayIds = storedDays.map((day) => day.id);
  const dayPlaceLinks = storedDayIds.length ? await db.select().from(dayPlaceRecords).where(inArray(dayPlaceRecords.dayId, storedDayIds)).orderBy(asc(dayPlaceRecords.sortOrder)) : [];
  const memberLinks = await db.select({ tripId: tripMemberRecords.tripId, id: memberRecords.id, name: memberRecords.name, displayName: memberRecords.displayName, avatar: memberRecords.avatar, active: memberRecords.active, createdAt: memberRecords.createdAt })
    .from(tripMemberRecords).innerJoin(memberRecords, eq(tripMemberRecords.memberId, memberRecords.id)).where(inArray(tripMemberRecords.tripId, tripIds));

  return rows.map((row) => ({
    ...row,
    status: row.status as TripStatus,
    cities: cityLinks.filter((link) => link.tripId === row.id).map(({ id, slug, name }) => ({ id, slug, name })),
    stages: stageLinks.filter((stage) => stage.tripId === row.id).map((stage) => ({
      id: stage.id,
      tripId: row.id,
      cityId: stage.cityId,
      title: stage.title,
      sortOrder: stage.sortOrder,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
      city: { id: stage.cityId, slug: stage.citySlug, name: stage.cityName },
      members: stageMemberLinks.filter((member) => member.stageId === stage.id).map((member) => ({ id: member.id, name: member.name, displayName: member.displayName, avatar: member.avatar, active: Boolean(member.active), createdAt: member.createdAt })),
    })),
    days: storedDays.filter((day) => day.tripId === row.id).map((day) => ({
      id: day.id,
      tripId: day.tripId,
      date: day.date,
      title: day.title,
      updatedAt: day.updatedAt,
      placeIds: dayPlaceLinks.filter((link) => link.dayId === day.id).map((link) => link.placeId),
    })),
    expenses: [],
    photos: [],
    createdByMemberId: row.createdByMemberId,
    updatedByMemberId: row.updatedByMemberId,
    members: memberLinks.filter((link) => link.tripId === row.id).map((member) => ({ id: member.id, name: member.name, displayName: member.displayName, avatar: member.avatar, active: Boolean(member.active), createdAt: member.createdAt })),
  }));
}

export async function listTrips(status: TripStatus | "all" = "all") {
  const db = getDb();
  const rows = status === "all"
    ? await db.select().from(tripRecords).orderBy(desc(tripRecords.createdAt))
    : await db.select().from(tripRecords).where(eq(tripRecords.status, status)).orderBy(desc(tripRecords.createdAt));
  const storedTrips = await hydrateTrips(rows);
  const seeds = seedFallbackAllowed() ? (status === "all" ? seedTrips : seedTrips.filter((trip) => trip.status === status)) : [];
  const storedSlugs = new Set(storedTrips.map((trip) => trip.slug));
  return [...storedTrips, ...seeds.filter((trip) => !storedSlugs.has(trip.slug))];
}

export async function findTripBySlug(slug: string) {
  const db = getDb();
  const rows = await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1);
  const stored = (await hydrateTrips(rows))[0];
  if (stored) return stored;
  return seedFallbackAllowed() ? getSeedTripBySlug(slug) : undefined;
}

async function slugExists(slug: string) {
  if (seedFallbackAllowed() && getSeedTripBySlug(slug)) return true;
  const rows = await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1);
  return rows.length > 0;
}

async function uniqueSlug(base: string) {
  if (!(await slugExists(base))) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await slugExists(candidate))) return candidate;
  }
  throw new Error("无法生成唯一行程地址，请稍后重试。");
}

export async function createTrip(input: CreateTripInput, actorMemberId: string) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(createStableSlugBase(input.title, input.startDate, id));
  const cityNames = normalizeCityNames(input.cities || []);
  const days = generateDays(id, input.startDate, input.endDate);

  await db.insert(tripRecords).values({
    id,
    slug,
    title: input.title,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    people: input.people,
    cover: input.cover,
    createdAt: now,
    updatedAt: now,
    timezone: "Asia/Shanghai",
    createdByMemberId: actorMemberId,
    updatedByMemberId: actorMemberId,
  });

  for (const [position, name] of cityNames.entries()) {
    let city = (await db.select().from(cityRecords).where(eq(cityRecords.name, name)).limit(1))[0];
    if (!city) {
      const cityId = crypto.randomUUID();
      city = { id: cityId, slug: `city-${cityId.slice(0, 8)}`, name, createdAt: now };
      await db.insert(cityRecords).values(city);
    }
    await db.insert(tripCityRecords).values({ tripId: id, cityId: city.id, position });
  }

  if (days.length) {
    await db.insert(dayRecords).values(days.map((day, index) => ({
      id: day.id,
      tripId: id,
      dayNumber: index + 1,
      date: day.date,
      title: day.title,
      updatedAt: now,
    })));
  }

  const memberIds = [...new Set([...input.memberIds, actorMemberId])];
  if (memberIds.length) await db.insert(tripMemberRecords).values(memberIds.map((memberId) => ({ tripId: id, memberId })));

  return (await findTripBySlug(slug))!;
}

async function replaceCitiesAndDays(tripId: string, input: UpdateTripInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const requestedCities = normalizeCityNames(input.cities || []);
  const days = generateDays(tripId, input.startDate, input.endDate);
  const existingDays = await db.select().from(dayRecords).where(eq(dayRecords.tripId, tripId)).orderBy(asc(dayRecords.dayNumber));
  const requestedDates = new Set(days.map((day) => day.date));
  const removedDays = existingDays.filter((day) => !day.date || !requestedDates.has(day.date));
  if (removedDays.length) {
    const d1 = getRuntimeEnv().DB;
    for (const day of removedDays) {
      const occupied = await d1.prepare(`SELECT
        (SELECT COUNT(*) FROM itinerary_items WHERE day_id = ?) +
        (SELECT COUNT(*) FROM day_member_presence WHERE day_id = ?) +
        (SELECT COUNT(*) FROM day_timeline_positions WHERE day_id = ?) +
        (SELECT COUNT(*) FROM route_preferences WHERE day_id = ?) +
        (SELECT COUNT(*) FROM day_places WHERE day_id = ?) +
        (SELECT COUNT(*) FROM expenses WHERE day_id = ?) AS count`).bind(day.id, day.id, day.id, day.id, day.id, day.id).first() as { count: number } | null;
      if (Number(occupied?.count || 0) > 0) throw new Error(`TRIP_DATE_SHORTEN_BLOCKED:${day.date || day.title}`);
    }
  }
  // Validate all destructive date changes before touching either Days or the
  // derived TripCity index. An aborted edit must leave the Trip unchanged.
  if (requestedCities.length) {
    await db.delete(tripCityRecords).where(eq(tripCityRecords.tripId, tripId));
  }
  for (const [position, name] of requestedCities.entries()) {
    let city = (await db.select().from(cityRecords).where(eq(cityRecords.name, name)).limit(1))[0];
    if (!city) { const id = crypto.randomUUID(); city = { id, slug: `city-${id.slice(0, 8)}`, name, createdAt: now }; await db.insert(cityRecords).values(city); }
    await db.insert(tripCityRecords).values({ tripId, cityId: city.id, position });
  }
  // Match by calendar date so inserting an earlier date never shifts existing
  // content to a different day.  Temporary negative numbers avoid UNIQUE
  // collisions while the chronological positions are rewritten.
  const d1 = getRuntimeEnv().DB;
  if (existingDays.length) await d1.batch(existingDays.map((day, index) => d1.prepare("UPDATE days SET day_number = ? WHERE id = ?").bind(-(index + 1), day.id)));
  const byDate = new Map(existingDays.filter((day) => day.date).map((day) => [day.date!, day]));
  for (const [index, day] of days.entries()) {
    const existing = day.date ? byDate.get(day.date) : undefined;
    if (existing) await db.update(dayRecords).set({ dayNumber: index + 1, title: `Day ${index + 1}`, updatedAt: now }).where(eq(dayRecords.id, existing.id));
    else await db.insert(dayRecords).values({ id: crypto.randomUUID(), tripId, dayNumber: index + 1, date: day.date, title: `Day ${index + 1}`, updatedAt: now });
  }
  for (const removed of removedDays) await db.delete(dayRecords).where(eq(dayRecords.id, removed.id));
}

export async function updateTrip(slug: string, input: UpdateTripInput, actorMemberId: string) {
  const db = getDb();
  const row = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!row) return null;
  const memberIds = [...new Set([...input.memberIds, actorMemberId])];
  const currentMembers = await db.select().from(tripMemberRecords).where(eq(tripMemberRecords.tripId, row.id));
  const currentIds = new Set(currentMembers.map((member) => member.memberId)), requestedIds = new Set(memberIds);
  const d1 = getRuntimeEnv().DB;
  // Validate removals before date/city mutation. This keeps a rejected edit
  // fully non-destructive even though D1 does not expose a cross-call ORM
  // transaction here.
  for (const memberId of currentIds) if (!requestedIds.has(memberId)) {
    const references = await d1.prepare(`SELECT
      (SELECT COUNT(*) FROM booking_participants bp JOIN bookings b ON b.id = bp.booking_id WHERE b.trip_id = ? AND bp.member_id = ?) +
      (SELECT COUNT(*) FROM booking_cost_allocations a JOIN booking_cost_lines l ON l.id = a.cost_line_id JOIN bookings b ON b.id = l.booking_id WHERE b.trip_id = ? AND a.member_id = ?) +
      (SELECT COUNT(*) FROM day_member_presence WHERE trip_id = ? AND member_id = ?) +
      (SELECT COUNT(*) FROM member_presence_windows WHERE trip_id = ? AND member_id = ?) +
      (SELECT COUNT(*) FROM itinerary_item_participant_overrides o JOIN itinerary_items i ON i.id = o.itinerary_item_id WHERE i.trip_id = ? AND o.member_id = ?) +
      (SELECT COUNT(*) FROM expense_allocations a JOIN expenses e ON e.id = a.expense_id WHERE e.trip_id = ? AND a.member_id = ?) +
      (SELECT COUNT(*) FROM expenses WHERE trip_id = ? AND (paid_by_member_id = ? OR created_by_member_id = ?)) AS count`).bind(row.id, memberId, row.id, memberId, row.id, memberId, row.id, memberId, row.id, memberId, row.id, memberId, row.id, memberId, memberId).first() as { count: number } | null;
    if (Number(references?.count || 0) > 0) throw new Error(`TRIP_MEMBER_REMOVE_BLOCKED:${memberId}`);
  }
  await replaceCitiesAndDays(row.id, input);
  for (const memberId of currentIds) if (!requestedIds.has(memberId)) {
    await db.delete(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, row.id), eq(tripMemberRecords.memberId, memberId)));
  }
  const additions = memberIds.filter((memberId) => !currentIds.has(memberId));
  if (additions.length) await db.insert(tripMemberRecords).values(additions.map((memberId) => ({ tripId: row.id, memberId })));
  await db.update(tripRecords).set({ title: input.title, status: input.status, startDate: input.startDate, endDate: input.endDate, people: memberIds.length || input.people, cover: input.cover, updatedAt: new Date().toISOString(), updatedByMemberId: actorMemberId }).where(eq(tripRecords.id, row.id));
  return findTripBySlug(slug);
}

export async function deleteTrip(slug: string) {
  const db = getDb();
  const row = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!row) return false;
  // D1/SQLite evaluates RESTRICT foreign keys while cascading a parent
  // delete.  A legacy Trip can have itinerary items that still reference a
  // Trip stage, so deleting `trips` directly may try to remove the stage
  // before those items and fail with a generic constraint error.  Remove
  // only Trip-owned rows in dependency order inside one D1 batch; shared
  // Members, Cities, Places, and cross-Trip source rows are never touched.
  const d1 = getRuntimeEnv().DB;
  if (!d1) throw new Error("D1 binding unavailable");
  const tripId = row.id;
  await d1.batch([
    d1.prepare("DELETE FROM itinerary_item_participant_overrides WHERE itinerary_item_id IN (SELECT id FROM itinerary_items WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM day_timeline_positions WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM route_preferences WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM day_places WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM day_member_presence WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM framework_constraints WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM itinerary_items WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM member_presence_windows WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM booking_cost_allocations WHERE cost_line_id IN (SELECT id FROM booking_cost_lines WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = ?))").bind(tripId),
    d1.prepare("DELETE FROM booking_cost_lines WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM booking_participants WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM bookings WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM expense_allocations WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM expenses WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM recommendation_member_states WHERE recommendation_id IN (SELECT id FROM recommendations WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM recommendation_place_options WHERE recommendation_id IN (SELECT id FROM recommendations WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM recommendations WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM trip_saved_places WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM member_budget_plans WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM trip_stage_members WHERE stage_id IN (SELECT id FROM trip_stages WHERE trip_id = ?)").bind(tripId),
    d1.prepare("DELETE FROM trip_stages WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM trip_cities WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM trip_places WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM trip_members WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM days WHERE trip_id = ?").bind(tripId),
    d1.prepare("DELETE FROM trips WHERE id = ?").bind(tripId),
  ]);
  return true;
}
