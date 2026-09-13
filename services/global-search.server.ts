import { and, eq, inArray, isNull, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, placeRecords, recommendationPlaceOptionRecords, recommendationRecords, tripCityRecords, tripMemberRecords, tripPlaceRecords, tripRecords } from "@/db/schema";

export type GlobalSearchResult = { type: "trip" | "city" | "recommendation" | "place"; id: string; title: string; subtitle: string; href: string };

export async function searchMemberWorkspace(memberId: string, rawQuery: string): Promise<GlobalSearchResult[]> {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return [];
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const db = getDb();
  const authorizedTrips = await db.select({ id: tripRecords.id, slug: tripRecords.slug, title: tripRecords.title })
    .from(tripMemberRecords).innerJoin(tripRecords, eq(tripMemberRecords.tripId, tripRecords.id))
    .where(and(eq(tripMemberRecords.memberId, memberId), like(tripRecords.title, pattern))).limit(8);
  const membership = await db.select({ tripId: tripMemberRecords.tripId }).from(tripMemberRecords).where(eq(tripMemberRecords.memberId, memberId));
  const tripIds = membership.map((row) => row.tripId);
  if (!tripIds.length) return authorizedTrips.map((trip) => ({ type: "trip", id: trip.id, title: trip.title, subtitle: "行程", href: `/trips/${trip.slug}/plan` }));
  const [cities, recommendations, tripPlaces, recommendationPlaces] = await Promise.all([
    db.select({ id: cityRecords.id, slug: cityRecords.slug, name: cityRecords.name }).from(tripCityRecords).innerJoin(cityRecords, eq(tripCityRecords.cityId, cityRecords.id)).where(and(inArray(tripCityRecords.tripId, tripIds), like(cityRecords.name, pattern))).limit(8),
    db.select({ id: recommendationRecords.id, tripId: recommendationRecords.tripId, title: recommendationRecords.title, category: recommendationRecords.category, slug: tripRecords.slug }).from(recommendationRecords).innerJoin(tripRecords, eq(recommendationRecords.tripId, tripRecords.id)).where(and(inArray(recommendationRecords.tripId, tripIds), isNull(recommendationRecords.deletedAt), or(like(recommendationRecords.title, pattern), like(recommendationRecords.summary, pattern)))).limit(12),
    db.select({ id: placeRecords.id, name: placeRecords.name, address: placeRecords.address, tripId: tripPlaceRecords.tripId, slug: tripRecords.slug }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).innerJoin(tripRecords, eq(tripPlaceRecords.tripId, tripRecords.id)).where(and(inArray(tripPlaceRecords.tripId, tripIds), or(like(placeRecords.name, pattern), like(placeRecords.address, pattern)))).limit(12),
    db.select({ id: placeRecords.id, name: placeRecords.name, address: placeRecords.address, tripId: recommendationRecords.tripId, slug: tripRecords.slug }).from(recommendationPlaceOptionRecords).innerJoin(placeRecords, eq(recommendationPlaceOptionRecords.placeId, placeRecords.id)).innerJoin(recommendationRecords, eq(recommendationPlaceOptionRecords.recommendationId, recommendationRecords.id)).innerJoin(tripRecords, eq(recommendationRecords.tripId, tripRecords.id)).where(and(inArray(recommendationRecords.tripId, tripIds), isNull(recommendationRecords.deletedAt), or(like(placeRecords.name, pattern), like(placeRecords.address, pattern)))).limit(12),
  ]);
  const results: GlobalSearchResult[] = [
    ...authorizedTrips.map((trip) => ({ type: "trip" as const, id: trip.id, title: trip.title, subtitle: "行程", href: `/trips/${trip.slug}/plan` })),
    ...cities.map((city) => ({ type: "city" as const, id: city.id, title: city.name, subtitle: "目的地", href: `/cities/${city.slug}` })),
    ...recommendations.map((item) => ({ type: "recommendation" as const, id: item.id, title: item.title, subtitle: `攻略素材 · ${item.category}`, href: `/trips/${item.slug}/plan?view=planning&focusRecommendation=${item.id}` })),
    ...[...tripPlaces, ...recommendationPlaces].map((place) => ({ type: "place" as const, id: `${place.tripId}:${place.id}`, title: place.name, subtitle: place.address || "地点", href: `/trips/${place.slug}/plan?view=map&mode=library&focusPlace=${place.id}` })),
  ];
  return [...new Map(results.map((result) => [`${result.type}:${result.id}`, result])).values()].slice(0, 30);
}
