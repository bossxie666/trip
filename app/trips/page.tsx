/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { listTrips } from "@/services/trip-repository.server";
import { getCurrentMember, tripDeletionMemberId } from "@/services/auth.server";
import type { TripStatus } from "@/models/travel";
import { TripDeleteButton } from "@/components/trip/TripDeleteButton";

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
  const [actor, trips] = await Promise.all([getCurrentMember(), listTrips(activeStatus)]);

  return (
    <main className="archive-index">
      <nav><a href="/">返回首页</a></nav>
      <header><span>TRIPS</span><h1>攻略</h1><a className="new-trip-link" href="/trips/new">＋ 新建行程</a></header>
      <nav className="trip-tabs" aria-label="行程状态">{filters.map((filter) => <a key={filter.value} className={activeStatus === filter.value ? "active" : ""} href={filter.value === "all" ? "/trips" : `/trips?status=${filter.value}`}>{filter.label}</a>)}</nav>
      <section className="trip-list">
        {!trips.length && <div className="trip-empty"><h2>这里还没有行程</h2><p>{activeStatus === "completed" ? "完成一次旅行后，它会出现在这里。" : "可以新建一条行程开始记录。"}</p></div>}
        {trips.map((trip) => (
          <article className="trip-list-card" key={trip.id}>
            <a className="trip-card-main" href={`/trips/${trip.slug}`}>
              {trip.cover ? <img src={trip.cover} alt="" /> : <div className="trip-cover-empty">NO COVER</div>}
              <div><span>{statusLabels[trip.status]}</span><h2>{trip.title}</h2><p>{trip.startDate && trip.endDate ? `${trip.startDate} — ${trip.endDate}` : "日期未定"}</p><p>{trip.cities.length ? trip.cities.map((city) => city.name).join("、") : "暂无城市"} · {participantSummary(trip)}</p></div>
            </a>
            <div className="trip-card-footer">
              <div className="trip-card-delete">
                <TripDeleteButton slug={trip.slug} title={trip.title} protected={trip.protected} canDelete={actor?.id === tripDeletionMemberId} />
              </div>
              <a className="trip-plan-link" href={`/trips/${trip.slug}/plan`}>规划行程 →</a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
