import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createTripRequestContext } from "@/services/request-data-context.server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const context = await createTripRequestContext((await params).slug);
  const trip = context.permissions.canRead ? context.trip : null;
  return trip ? {
    title: `${trip.title} · 跳进地理书的旅行`,
    description: `${trip.title} 的旅行规划工作台。`,
  } : {};
}

export default async function TripDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await createTripRequestContext(slug);
  if (!context.permissions.canRead) notFound();
  // Every Trip now enters the same planning workspace. Keep this route as a
  // compatibility redirect for bookmarks and old links, without retaining a
  // second detail renderer for any slug.
  redirect(`/trips/${slug}/plan`);
}
