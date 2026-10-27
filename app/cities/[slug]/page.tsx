/* eslint-disable @next/next/no-img-element */
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { listTripSummaries } from "@/services/trip-repository.server";
import { listAlbums } from "@/services/album-service.server";
import "../cities.css";

export const dynamic = "force-dynamic";
export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getCurrentMember();
  if (!actor) redirect(`/unlock?returnTo=${encodeURIComponent(`/cities/${slug}`)}`);
  const allTrips = await listTripSummaries("all", actor.id);
  const trips = allTrips.filter(trip => trip.cities.some(city => city.slug === slug));
  const city = trips[0]?.cities.find(city => city.slug === slug);
  if (!city) notFound();
  const tripIds = new Set(trips.map(trip => trip.id));
  const albums = (await listAlbums(actor.id)).filter(album => album.tripId && tripIds.has(album.tripId));
  const statusLabels = { inspiration: "灵感", planning: "待出行", completed: "已出行" };
  return <><SiteHeader currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="journal-subpage city-page"><Link href="/cities">← 目的地</Link><h1>{city.name}</h1><section aria-labelledby="city-trips"><h2 id="city-trips">我的旅行</h2><div className="city-link-grid">{trips.map(trip => <Link key={trip.id} href={`/trips/${trip.slug}/plan`}><h3>{trip.title}</h3><span>{statusLabels[trip.status]} · {trip.startDate || "日期未定"}{trip.endDate && trip.endDate !== trip.startDate ? ` — ${trip.endDate}` : ""}</span></Link>)}</div></section><section aria-labelledby="city-albums"><h2 id="city-albums">相册</h2>{albums.length ? <div className="city-link-grid">{albums.map(album => <Link key={album.id} href={`/albums/${album.id}`}>{album.coverMediaAssetId && <img src={`/api/media/${album.coverMediaAssetId}?variant=thumb`} alt="" width={80} height={80} loading="lazy" />}<h3>{album.title}</h3><span>{album.photoCount} 张照片</span></Link>)}</div> : <p>暂无关联相册</p>}</section></main></>;
}
