import Link from "next/link";
import type { Trip } from "@/models/travel";
import { EditTripForm } from "@/components/trip/EditTripForm";

const statusLabels = { inspiration: "灵感", planning: "待出行", completed: "已出行" };

function tripDates(trip: Trip) {
  return trip.startDate && trip.endDate ? `${trip.startDate} — ${trip.endDate}` : "日期未定";
}

export function GenericTripDetail({ trip, members }: { trip: Trip; members: { id: string; displayName: string }[] }) {
  return (
    <main className="generic-trip-detail">
      <nav><Link href="/trips">返回攻略中心</Link></nav>
      <header>
        <span>{statusLabels[trip.status]}</span>
        <h1>{trip.title}</h1>
        <p>{tripDates(trip)} · {trip.cities.length ? trip.cities.map((city) => city.name).join("、") : "暂无城市"} · {trip.people} 人</p>
      </header>
      <section><h2>概览</h2><p>这是一条新建行程，详细内容可以在后续阶段继续完善。</p></section>
      <section><h2>日程</h2>{trip.days.length ? <ol>{trip.days.map((day) => <li key={day.id}><b>{day.title}</b>{day.date && <span>{day.date}</span>}</li>)}</ol> : <p>日期未定，暂未生成 Day。</p>}</section>
      <section><h2>地图</h2><p>地图位置已预留，本阶段不接入地图服务。</p></section>
      <section><h2>预算</h2><p>还没有预算记录。</p></section>
      <section><h2>Checklist</h2><p>还没有待办事项。</p></section>
      <EditTripForm trip={trip} members={members} />
    </main>
  );
}
