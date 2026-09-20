import { listTrips } from "@/services/trip-repository.server";
import { getCurrentMember, tripDeletionMemberId } from "@/services/auth.server";
import type { TripStatus } from "@/models/travel";
import { TripBookCard } from "@/components/trip/TripBookCard";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { SiteHeader } from "@/components/site/SiteHeader";

const statusLabels = {
  inspiration: "灵感",
  planning: "待出行",
  completed: "已出行",
};

const filters: { value: TripStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" }, { value: "inspiration", label: "灵感" },
  { value: "planning", label: "待出行" }, { value: "completed", label: "已出行" },
];

function participantSummary(trip: Awaited<ReturnType<typeof listTrips>>[number]) {
  const stages = trip.stages?.filter((stage) => stage.members?.length);
  if (stages?.length) return stages.map((stage) => `${stage.city?.name || stage.title}${stage.members?.length}人`).join(" · ");
  return `${trip.members?.length || trip.people} 人`;
}

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const activeStatus = filters.some((filter) => filter.value === requested) ? requested as TripStatus : "all";
  const actor = await getCurrentMember();
  const trips = actor ? await listTrips(activeStatus, actor.id) : [];

  return (<>
    {actor && <SiteHeader active="trips" currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar }} />}
    <main className="archive-index archive-index-with-shell">
      <div className="archive-index-toolbar"><nav className="trip-tabs" aria-label="行程状态">{filters.map((filter) => <Link key={filter.value} className={activeStatus === filter.value ? "active" : ""} href={filter.value === "all" ? "/trips" : `/trips?status=${filter.value}`}>{filter.label}</Link>)}</nav><Link className="new-trip-link" href="/trips/new">＋ 新建行程</Link></div>
      <section className="trip-list">
        {!trips.length && <div className="trip-empty"><h2>这里还没有行程</h2><p>{activeStatus === "completed" ? "完成一次旅行后，它会出现在这里。" : "可以新建一条行程开始记录。"}</p></div>}
        {trips.map((trip, index) => <TripBookCard key={trip.id} index={index} canDelete={actor?.id === tripDeletionMemberId} trip={{ slug: trip.slug, title: trip.title, cover: trip.cover, statusLabel: statusLabels[trip.status], participantSummary: participantSummary(trip) }} />)}
      </section>
    </main>
  </>);
}
