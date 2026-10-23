"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Map, X } from "lucide-react";
import { hasCityCoordinates, type AtlasCity } from "@/services/atlas-cities";
import { CityMapCanvas } from "./CityMapCanvas";
import styles from "./home-live.module.css";

type TripLink = { id: string; title: string; slug: string; cityIds: string[] };

export function HomeCityMap({ cities, trips, className, embedded = false }: { cities: AtlasCity[]; trips: TripLink[]; className?: string; embedded?: boolean }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const ownsHistory = useRef(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  function close() {
    if (ownsHistory.current && history.state?.tripAtlasOpen) history.back();
    else { dialog.current?.close(); setOpen(false); }
  }
  function show(cityId: string | null = null) {
    if (dialog.current?.open) return;
    setSelected(cityId); setOpen(true);
    history.pushState({ ...history.state, tripAtlasOpen: true }, "", `${location.pathname}${location.search}#atlas`);
    ownsHistory.current = true;
    dialog.current?.showModal();
  }
  useEffect(() => {
    if (!open) return;
    const onBack = () => {
      if (!history.state?.tripAtlasOpen) {
        ownsHistory.current = false;
        dialog.current?.close(); setOpen(false);
      }
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [open]);
  const shownTrips = selected ? trips.filter((trip) => trip.cityIds.includes(selected)) : trips;
  return <>
    {embedded && <CityMapCanvas cities={cities} onSelect={(cityId) => show(cityId)} compact />}
    <button className={`${styles.mapTrigger} ${embedded ? styles.expandMap : ""} ${className || ""}`} type="button" onClick={() => show()}><Map size={16} />{embedded ? "展开地图" : "查看真实地图"}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className={styles.dialogHeader}><h2 id={titleId}>旅行城市地图</h2><button type="button" onClick={close} aria-label="关闭地图，返回首页"><X size={22} /></button></header>
      {open && <div className={styles.mapLayout}>
        <div className={styles.mapArea}>
          <CityMapCanvas cities={cities} selected={selected} onSelect={setSelected} />
        </div>
        <aside className={styles.mapSidebar}>
          <div className={styles.cityFilters}><button type="button" aria-pressed={!selected} onClick={() => setSelected(null)}>全部城市</button>{cities.map((city) => <button type="button" key={city.cityId} aria-pressed={selected === city.cityId} onClick={() => setSelected(city.cityId)}>{city.name}{!hasCityCoordinates(city) ? "（待定位）" : ""}</button>)}</div>
          <h3>{selected ? cities.find((city) => city.cityId === selected)?.name : "我的旅行"}</h3>
          {shownTrips.map((trip) => <a key={trip.id} className={styles.tripLink} href={`/trips/${encodeURIComponent(trip.slug)}/plan?view=map`}>{trip.title}<span aria-hidden="true">→</span></a>)}
          {!shownTrips.length && <p>暂无关联行程。</p>}
        </aside>
      </div>}
    </dialog>
  </>;
}
