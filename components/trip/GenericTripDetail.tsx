import Link from "next/link";
import type { Trip } from "@/models/travel";
import { EditTripForm } from "@/components/trip/EditTripForm";
import { DayPlacesEditor } from "@/components/trip/DayPlacesEditor";
import type { PlaceWorkspace } from "@/services/place-repository.server";

const statusLabels = { inspiration: "灵感", planning: "待出行", completed: "已出行" };

function tripDates(trip: Trip) {
  return trip.startDate && trip.endDate ? `${trip.startDate} — ${trip.endDate}` : "日期未定";
}

export function GenericTripDetail({ trip, members, placeWorkspace }: { trip: Trip; members: { id: string; displayName: string }[]; placeWorkspace: NonNullable<PlaceWorkspace> }) {
  return (
    <main className="generic-trip-detail">
      <nav><Link href="/trips">返回攻略中心</Link></nav>
      <header>
        <span>{statusLabels[trip.status]}</span>
        <h1>{trip.title}</h1>
        <p>{tripDates(trip)} · {trip.cities.length ? trip.cities.map((city) => city.name).join("、") : "暂无城市"} · {trip.people} 人</p>
      </header>
      <section><h2>概览</h2><p>这是一条新建行程，详细内容可以在后续阶段继续完善。</p></section>
      <section><h2>日程</h2><DayPlacesEditor slug={trip.slug} initial={placeWorkspace} /></section>
      <section><h2>地图</h2><p>已添加 {new Set(placeWorkspace.days.flatMap((day) => day.places.map((item) => item.place.id))).size} 个地点，地图将在后续版本启用。</p></section>
      <section><h2>预算</h2><p>还没有预算记录。</p></section>
      <section><h2>Checklist</h2><p>还没有待办事项。</p></section>
      <EditTripForm trip={trip} members={members} />
    </main>
  );
}
