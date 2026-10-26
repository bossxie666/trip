import { and, eq, inArray, isNull, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { cityRecords, placeRecords, recommendationPlaceOptionRecords, recommendationRecords, tripCityRecords, tripMemberRecords, tripPlaceRecords, tripRecords } from "@/db/schema";
import { listKnowledge } from "@/services/knowledge-service.server";

export type GlobalSearchResult = { type: "trip" | "city" | "recommendation" | "place" | "knowledge"; id: string; title: string; subtitle: string; href: string };

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
  const knowledgePromise = listKnowledge(memberId, { q: query, pageSize: 12 });
  if (!tripIds.length) return (await knowledgePromise).map((item) => ({ type: "knowledge", id: item.id, title: item.title, subtitle: item.section === "photography" ? "拍照知识" : item.section === "transition_video" ? "转场视频" : "旅游攻略", href: `/knowledge/${item.id}` }));
  const [cities, tripPlaces, recommendationPlaces, knowledge] = await Promise.all([
    db.select({ id: cityRecords.id, slug: cityRecords.slug, name: cityRecords.name }).from(tripCityRecords).innerJoin(cityRecords, eq(tripCityRecords.cityId, cityRecords.id)).where(and(inArray(tripCityRecords.tripId, tripIds), like(cityRecords.name, pattern))).limit(8),
    db.select({ id: placeRecords.id, name: placeRecords.name, address: placeRecords.address, tripId: tripPlaceRecords.tripId, slug: tripRecords.slug }).from(tripPlaceRecords).innerJoin(placeRecords, eq(tripPlaceRecords.placeId, placeRecords.id)).innerJoin(tripRecords, eq(tripPlaceRecords.tripId, tripRecords.id)).where(and(inArray(tripPlaceRecords.tripId, tripIds), or(like(placeRecords.name, pattern), like(placeRecords.address, pattern)))).limit(12),
    db.select({ id: placeRecords.id, name: placeRecords.name, address: placeRecords.address, tripId: recommendationRecords.tripId, slug: tripRecords.slug }).from(recommendationPlaceOptionRecords).innerJoin(placeRecords, eq(recommendationPlaceOptionRecords.placeId, placeRecords.id)).innerJoin(recommendationRecords, eq(recommendationPlaceOptionRecords.recommendationId, recommendationRecords.id)).innerJoin(tripRecords, eq(recommendationRecords.tripId, tripRecords.id)).where(and(inArray(recommendationRecords.tripId, tripIds), isNull(recommendationRecords.deletedAt), or(like(placeRecords.name, pattern), like(placeRecords.address, pattern)))).limit(12),
    knowledgePromise,
  ]);
  const results: GlobalSearchResult[] = [
    ...authorizedTrips.map((trip) => ({ type: "trip" as const, id: trip.id, title: trip.title, subtitle: "行程", href: `/trips/${trip.slug}/plan` })),
    ...cities.map((city) => ({ type: "city" as const, id: city.id, title: city.name, subtitle: "目的地", href: `/cities/${city.slug}` })),
    ...[...tripPlaces, ...recommendationPlaces].map((place) => ({ type: "place" as const, id: `${place.tripId}:${place.id}`, title: place.name, subtitle: place.address || "地点", href: `/trips/${place.slug}/plan?view=map&mode=library&focusPlace=${place.id}` })),
    ...knowledge.map((item) => ({ type: "knowledge" as const, id: item.id, title: item.title, subtitle: item.section === "photography" ? "拍照知识" : item.section === "transition_video" ? "转场视频" : "旅游攻略", href: `/knowledge/${item.id}` })),
  ];
  return [...new Map(results.map((result) => [`${result.type}:${result.id}`, result])).values()].slice(0, 30);
}
