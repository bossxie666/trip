import { getCurrentMember } from "@/services/auth.server";
import { redirect } from "next/navigation";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { PlanMap } from "@/components/trip/PlanMap";
import { SiteHeader } from "@/components/site/SiteHeader";
import "../workspace-base.css";
import { listTrips } from "@/services/trip-repository.server";

export default async function MapPage() {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2Fmap");
  const trips = current ? await listTrips("all", current.id) : [];
  const trip = trips.find(trip => trip.status === "planning") || trips[0];
  if (trip) redirect(`/trips/${encodeURIComponent(trip.slug)}/plan?view=map`);
  return <><SiteHeader active="map" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar, role: current.role }} /><main className="standalone-map"><p>创建旅行后可添加地点与路线。<Link href="/trips/new">创建旅行</Link></p><PlanMap slug="" places={[]} compact /></main></>;
}
