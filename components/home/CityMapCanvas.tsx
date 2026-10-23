"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadAMap } from "@/components/trip/load-amap";
import type { AMapMarker, AMapObject } from "@/components/trip/amap-client-types";
import { hasCityCoordinates, type AtlasCity } from "@/services/atlas-cities";
import styles from "./home-live.module.css";

/** Real city centers only. No POIs, inferred routes, or writes on the homepage. */
export function CityMapCanvas({ cities, selected, onSelect, compact = false }: {
  cities: AtlasCity[];
  selected?: string | null;
  onSelect: (cityId: string) => void;
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapObject | null>(null);
  const markersRef = useRef<AMapMarker[]>([]);
  const selectRef = useRef(onSelect);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const available = useMemo(() => cities.filter(hasCityCoordinates), [cities]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const target = container.current;
    if (!target || !available.length) return;
    let cancelled = false;
    let started = false;
    let map: AMapObject | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setReady(false); setError("");
    function initialize() {
      if (started || cancelled || !target || !target.clientWidth || !target.clientHeight) return;
      started = true;
      loadAMap().then((AMap) => {
        if (cancelled) return;
        map = new AMap.Map(target!, {
          zoom: available.length === 1 ? 10 : 5,
          center: [available[0].centerLng, available[0].centerLat],
          viewMode: "2D", scrollWheel: !compact, keyboardEnable: !compact,
        });
        mapRef.current = map;
        const onComplete = () => {
          if (!cancelled) { clearTimeout(timer); setError(""); setReady(true); }
        };
        map.on("complete", onComplete);
        const markers = available.map((city) => {
          const label = document.createElement("span");
          label.className = styles.cityLabel;
          label.textContent = city.name;
          const marker = new AMap.Marker({ position: [city.centerLng, city.centerLat], title: city.name, label: { content: label, direction: "top" } });
          marker.on?.("click", () => selectRef.current(city.cityId));
          return marker;
        });
        markersRef.current = markers;
        map.add(markers);
        if (markers.length > 1) map.setFitView(markers);
        timer = setTimeout(() => {
          if (!cancelled) setError("地图底图加载较慢，请重试。");
        }, 15_000);
      }).catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "地图暂时无法连接，请重试。");
      });
    }
    const resize = new ResizeObserver(() => { initialize(); map?.resize?.(); });
    resize.observe(target);
    initialize();
    return () => { cancelled = true; resize.disconnect(); clearTimeout(timer); map?.destroy(); mapRef.current = null; markersRef.current = []; };
  }, [available, attempt, compact]);

  useEffect(() => {
    const city = available.find((city) => city.cityId === selected);
    if (city) mapRef.current?.setCenter?.([city.centerLng, city.centerLat]);
    else if (ready) mapRef.current?.setFitView(markersRef.current);
  }, [available, ready, selected]);

  return <div className={`${styles.cityMapRoot}${compact ? ` ${styles.compactMap}` : ""}`}>
    <div ref={container} className={styles.mapCanvas} aria-label="可拖动、缩放的高德城市地图" />
    {!available.length && <p className={styles.mapStatus}>{cities.length ? "行程城市暂缺中心坐标，定位确认后显示。" : "还没有行程城市。"}</p>}
    {!!available.length && !ready && !error && <p className={styles.mapStatus} role="status">正在加载高德地图…</p>}
    {error && <div className={styles.mapStatus} role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setReady(false); setAttempt((value) => value + 1); }}>重新加载地图</button>{error.includes("登录") && <a href={`/unlock?returnTo=${encodeURIComponent(typeof location === "undefined" ? "/" : location.pathname + location.search)}`}>重新登录</a>}</div>}
  </div>;
}
