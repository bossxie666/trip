import { getCurrentMember } from "@/services/auth.server";
import { SiteHeader } from "@/components/site/SiteHeader";
import { listTrips } from "@/services/trip-repository.server";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";

export default async function MapPage() {
  const current = await getCurrentMember();
  const trips = current ? await listTrips("all", current.id) : [];
  return <>{current && <SiteHeader active="map" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} />}<main className="map-index"><div className="map-index-list">{trips.map((trip) => <Link className="map-index-entry" href={`/trips/${trip.slug}/plan?view=map`} key={trip.id}><span>{trip.status === "completed" ? "已出行" : trip.status === "planning" ? "待出行" : "灵感"}</span><strong>{trip.title}</strong><small>{trip.cities.map((city) => city.name).join(" · ") || "暂无城市"}</small><b aria-hidden="true">→</b></Link>)}{!trips.length && <p className="map-index-empty">新建一条行程后，这里会直接打开它的地图。</p>}</div></main></>;
}
