import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllTrips, protectedTripSlug } from "@/data/trips";
import { findTripBySlug } from "@/services/trip-repository.server";
import { TripDetailPage } from "@/components/trip/TripDetailPage";
import ShanghaiHangzhouTripDetail from "@/components/trip/ShanghaiHangzhouTripDetail";
import { GenericTripDetail } from "@/components/trip/GenericTripDetail";
import { listActiveMembers } from "@/services/member-repository.server";

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
  const trip = await findTripBySlug(slug);
  if (!trip) notFound();
  const members = slug === protectedTripSlug ? [] : await listActiveMembers();

  return (
    <TripDetailPage trip={trip}>
      {slug === protectedTripSlug ? <ShanghaiHangzhouTripDetail /> : <GenericTripDetail trip={trip} members={members} />}
    </TripDetailPage>
  );
}
