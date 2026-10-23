"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full-document entry links preserve cross-workspace browser history. */

import { useEffect, useId, useRef, useState } from "react";
import { Map, X } from "lucide-react";
import { loadAMap } from "@/components/trip/load-amap";
import type { AMapObject } from "@/components/trip/amap-client-types";
import { hasCityCoordinates, type AtlasCity } from "@/services/atlas-cities";
import styles from "./home-live.module.css";

type TripLink = { id: string; title: string; slug: string; cityIds: string[] };

export function HomeCityMap({ cities, trips, className }: { cities: AtlasCity[]; trips: TripLink[]; className?: string }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapObject | null>(null);
  const ownsHistory = useRef(false);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const available = cities.filter(hasCityCoordinates);
  function chooseCity(id: string | null) {
    setSelected(id);
    const city = available.find((city) => city.cityId === id);
    if (city) mapRef.current?.setCenter?.([city.centerLng, city.centerLat]);
  }

  function close() {
    if (ownsHistory.current && history.state?.tripAtlasOpen) history.back();
    else { dialog.current?.close(); setOpen(false); }
  }
  function show() {
    setError(""); setReady(false); setOpen(true);
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
  useEffect(() => {
    if (!open || !available.length) return;
    let cancelled = false;
    let map: AMapObject | null = null;
    loadAMap().then((AMap) => {
      if (cancelled || !container.current) return;
      map = new AMap.Map(container.current, { zoom: available.length === 1 ? 10 : 5, center: [available[0].centerLng, available[0].centerLat], viewMode: "2D" });
      mapRef.current = map;
      const markers = available.map((city) => {
        const label = document.createElement("span");
        label.textContent = city.name;
        const marker = new AMap.Marker({ position: [city.centerLng, city.centerLat], title: city.name, label: { content: label, direction: "top" } });
        marker.on?.("click", () => setSelected(city.cityId));
        return marker;
      });
      map.add(markers);
      if (markers.length > 1) map.setFitView(markers);
      setReady(true);
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "地图暂时无法连接，请重试。");
    });
    return () => { cancelled = true; map?.destroy(); mapRef.current = null; };
    // The parent server component supplies a stable, authorized city snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt, cities]);

  const shownTrips = selected ? trips.filter((trip) => trip.cityIds.includes(selected)) : trips;
  return <>
    <button className={`${styles.mapTrigger} ${className || ""}`} type="button" onClick={show}><Map size={16} />查看真实地图</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className={styles.dialogHeader}><h2 id={titleId}>旅行城市地图</h2><button type="button" onClick={close} aria-label="关闭地图，返回首页"><X size={22} /></button></header>
      {open && <div className={styles.mapLayout}>
        <div className={styles.mapArea}>
          <div ref={container} className={styles.mapCanvas} aria-label="高德城市地图" />
          {!available.length && <p className={styles.mapStatus}>还没有可定位的行程城市。<a href="/trips/new">新建行程</a></p>}
          {!!available.length && !ready && !error && <p className={styles.mapStatus} role="status">正在加载高德地图…</p>}
          {error && <div className={styles.mapStatus} role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setReady(false); setAttempt((value) => value + 1); }}>重新加载地图</button>{error.includes("登录") && <a href={`/unlock?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>重新登录</a>}</div>}
        </div>
        <aside className={styles.mapSidebar}>
          <div className={styles.cityFilters}><button type="button" aria-pressed={!selected} onClick={() => chooseCity(null)}>全部城市</button>{cities.map((city) => <button type="button" key={city.cityId} aria-pressed={selected === city.cityId} onClick={() => chooseCity(city.cityId)}>{city.name}{!hasCityCoordinates(city) ? "（待定位）" : ""}</button>)}</div>
          <h3>{selected ? cities.find((city) => city.cityId === selected)?.name : "我的旅行"}</h3>
          {shownTrips.map((trip) => <a key={trip.id} className={styles.tripLink} href={`/trips/${encodeURIComponent(trip.slug)}/plan?view=map`}>{trip.title}<span aria-hidden="true">→</span></a>)}
          {!shownTrips.length && <p>暂无关联行程。</p>}
        </aside>
      </div>}
    </dialog>
  </>;
}
