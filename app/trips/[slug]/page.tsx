import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllTrips, getTripBySlug } from "@/data/trips";
import { TripDetailPage } from "@/components/trip/TripDetailPage";
import ShanghaiHangzhouTripDetail from "@/components/trip/ShanghaiHangzhouTripDetail";

export function generateStaticParams() {
  return getAllTrips().map((trip) => ({ slug: trip.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const trip = getTripBySlug((await params).slug);
  return trip ? {
    title: `${trip.title} · 跳进地理书的旅行`,
    description: "深圳出发，两天一夜上海迪士尼、外滩与杭州衔接的可交互省钱旅行工作台。",
  } : {};
}

export default async function TripDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = getTripBySlug(slug);
  if (!trip) notFound();

  return (
    <TripDetailPage trip={trip}>
      <ShanghaiHangzhouTripDetail />
    </TripDetailPage>
  );
}
