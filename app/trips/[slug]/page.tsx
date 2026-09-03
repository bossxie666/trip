import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { findTripBySlug } from "@/services/trip-repository.server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const trip = await findTripBySlug((await params).slug);
  return trip ? {
    title: `${trip.title} · 跳进地理书的旅行`,
    description: `${trip.title} 的旅行规划工作台。`,
  } : {};
}

export default async function TripDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await findTripBySlug(slug);
  if (!trip) notFound();
  // Every Trip now enters the same planning workspace. Keep this route as a
  // compatibility redirect for bookmarks and old links, without retaining a
  // second detail renderer for any slug.
  redirect(`/trips/${slug}/plan`);
}
