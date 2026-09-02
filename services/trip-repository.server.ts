import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "@/db";
import { cityRecords, dayPlaceRecords, dayRecords, memberRecords, tripCityRecords, tripMemberRecords, tripRecords, tripStageMemberRecords, tripStageRecords } from "@/db/schema";
import { getTripBySlug as getSeedTripBySlug, trips as seedTrips } from "@/data/trips";
import type { Day, Trip, TripStatus } from "@/models/travel";

export type CreateTripInput = {
  title: string;
  status: Extract<TripStatus, "inspiration" | "planning">;
  cities: string[];
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
    protected: Boolean(row.protected),
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
  const cityNames = normalizeCityNames(input.cities);
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
  await db.delete(tripCityRecords).where(eq(tripCityRecords.tripId, tripId));
  for (const [position, name] of normalizeCityNames(input.cities).entries()) {
    let city = (await db.select().from(cityRecords).where(eq(cityRecords.name, name)).limit(1))[0];
    if (!city) { const id = crypto.randomUUID(); city = { id, slug: `city-${id.slice(0, 8)}`, name, createdAt: now }; await db.insert(cityRecords).values(city); }
    await db.insert(tripCityRecords).values({ tripId, cityId: city.id, position });
  }
  const days = generateDays(tripId, input.startDate, input.endDate);
  const existingDays = await db.select().from(dayRecords).where(eq(dayRecords.tripId, tripId)).orderBy(asc(dayRecords.dayNumber));
  for (const [index, day] of days.entries()) {
    const existing = existingDays[index];
    if (existing) await db.update(dayRecords).set({ dayNumber: index + 1, date: day.date, title: day.title, updatedAt: now }).where(eq(dayRecords.id, existing.id));
    else await db.insert(dayRecords).values({ id: day.id, tripId, dayNumber: index + 1, date: day.date, title: day.title, updatedAt: now });
  }
  for (const removed of existingDays.slice(days.length)) await db.delete(dayRecords).where(eq(dayRecords.id, removed.id));
}

export async function updateTrip(slug: string, input: UpdateTripInput, actorMemberId: string) {
  const db = getDb();
  const row = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!row) {
    if (getSeedTripBySlug(slug)) throw new Error("PROTECTED_TRIP");
    return null;
  }
  if (row.protected) throw new Error("PROTECTED_TRIP");
  await db.update(tripRecords).set({ title: input.title, status: input.status, startDate: input.startDate, endDate: input.endDate, people: input.people, cover: input.cover, updatedAt: new Date().toISOString(), updatedByMemberId: actorMemberId }).where(eq(tripRecords.id, row.id));
  await replaceCitiesAndDays(row.id, input);
  await db.delete(tripMemberRecords).where(eq(tripMemberRecords.tripId, row.id));
  const memberIds = [...new Set([...input.memberIds, actorMemberId])];
  if (memberIds.length) await db.insert(tripMemberRecords).values(memberIds.map((memberId) => ({ tripId: row.id, memberId })));
  return findTripBySlug(slug);
}

export async function deleteTrip(slug: string) {
  const db = getDb();
  const row = (await db.select().from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!row) {
    if (getSeedTripBySlug(slug)) throw new Error("PROTECTED_TRIP");
    return false;
  }
  if (row.protected) throw new Error("PROTECTED_TRIP");
  await db.delete(tripRecords).where(eq(tripRecords.id, row.id));
  return true;
}
