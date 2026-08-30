import Link from "next/link";
import { getAllTrips } from "@/data/trips";

const statusLabels = {
  inspiration: "灵感",
  planning: "待出行",
  completed: "已出行",
};

export default function TripsPage() {
  const trips = getAllTrips();

  return (
    <main className="archive-index">
      <nav><Link href="/">返回首页</Link></nav>
      <header><span>TRIPS</span><h1>攻略</h1></header>
      <div className="trip-tabs" aria-label="行程状态"><span>全部</span><span>灵感</span><span>待出行</span><span>已出行</span></div>
      <section className="trip-list">
        {trips.map((trip) => (
          <Link key={trip.id} href={`/trips/${trip.slug}`}>
            <span>{statusLabels[trip.status]}</span>
            <h2>{trip.title}</h2>
            <p>{trip.startDate} — {trip.endDate} · {trip.people} 人</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
