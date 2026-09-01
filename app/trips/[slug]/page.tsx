import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAllTrips, protectedTripSlug } from "@/data/trips";
import { findTripBySlug } from "@/services/trip-repository.server";
import { TripDetailPage } from "@/components/trip/TripDetailPage";
import { GenericTripDetail } from "@/components/trip/GenericTripDetail";
import { listActiveMembers } from "@/services/member-repository.server";
import { getPlaceWorkspace } from "@/services/place-repository.server";

export function generateStaticParams() {
  return getAllTrips().map((trip) => ({ slug: trip.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const trip = await findTripBySlug((await params).slug);
  return trip ? {
    title: `${trip.title} · 跳进地理书的旅行`,
    description: "深圳出发，两天一夜上海迪士尼、外滩与杭州衔接的可交互省钱旅行工作台。",
  } : {};
}

export default async function TripDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The dedicated Shanghai/Hangzhou page has been retired. Keep the old URL
  // as a stable compatibility link while the planning workspace is canonical.
  if (slug === protectedTripSlug) redirect(`/trips/${slug}/plan`);
  const trip = await findTripBySlug(slug);
  if (!trip) notFound();
  const [members, placeWorkspace] = await Promise.all([listActiveMembers(), getPlaceWorkspace(slug)]);

  return (
    <TripDetailPage trip={trip}>
      {placeWorkspace ? <GenericTripDetail trip={trip} members={members} placeWorkspace={placeWorkspace} /> : null}
    </TripDetailPage>
  );
}
