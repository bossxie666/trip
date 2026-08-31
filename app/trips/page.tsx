/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { listTrips } from "@/services/trip-repository.server";
import type { TripStatus } from "@/models/travel";

const statusLabels = {
  inspiration: "灵感",
  planning: "待出行",
  completed: "已出行",
};

const filters: { value: TripStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" }, { value: "inspiration", label: "灵感" },
  { value: "planning", label: "待出行" }, { value: "completed", label: "已出行" },
];

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const activeStatus = filters.some((filter) => filter.value === requested) ? requested as TripStatus : "all";
  const trips = await listTrips(activeStatus);

  return (
    <main className="archive-index">
      <nav><a href="/">返回首页</a></nav>
      <header><span>TRIPS</span><h1>攻略</h1><a className="new-trip-link" href="/trips/new">＋ 新建行程</a></header>
      <nav className="trip-tabs" aria-label="行程状态">{filters.map((filter) => <a key={filter.value} className={activeStatus === filter.value ? "active" : ""} href={filter.value === "all" ? "/trips" : `/trips?status=${filter.value}`}>{filter.label}</a>)}</nav>
      <section className="trip-list">
        {!trips.length && <div className="trip-empty"><h2>这里还没有行程</h2><p>{activeStatus === "completed" ? "完成一次旅行后，它会出现在这里。" : "可以新建一条行程开始记录。"}</p></div>}
        {trips.map((trip) => (
          <a key={trip.id} href={`/trips/${trip.slug}`}>
            {trip.cover ? <img src={trip.cover} alt="" /> : <div className="trip-cover-empty">NO COVER</div>}
            <div><span>{statusLabels[trip.status]}</span><h2>{trip.title}</h2><p>{trip.startDate && trip.endDate ? `${trip.startDate} — ${trip.endDate}` : "日期未定"}</p><p>{trip.cities.length ? trip.cities.map((city) => city.name).join("、") : "暂无城市"} · {trip.people} 人</p></div>
          </a>
        ))}
      </section>
    </main>
  );
}
