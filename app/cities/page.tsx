import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { listTripSummaries } from "@/services/trip-repository.server";
import "./cities.css";

export const dynamic = "force-dynamic";
export default async function CitiesPage() {
  const actor = await getCurrentMember();
  if (!actor) redirect("/unlock?returnTo=%2Fcities");
  const trips = await listTripSummaries("all", actor.id);
  const cities = [...new Map(trips.flatMap(trip => trip.cities.map(city => [city.cityId, city] as const))).values()];
  return <><SiteHeader currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="journal-subpage city-page"><h1>目的地</h1>{cities.length ? <section className="city-link-grid" aria-label="旅行目的地">{cities.map(city => <Link key={city.cityId} href={`/cities/${city.slug}`}><h2>{city.name}</h2><span>{trips.filter(trip => trip.cities.some(item => item.cityId === city.cityId)).length} 趟旅行</span></Link>)}</section> : <section className="city-empty"><p>暂无目的地</p><Link href="/trips">我的旅行</Link></section>}</main></>;
}
