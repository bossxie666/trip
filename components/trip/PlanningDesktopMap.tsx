"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PlanMapProps } from "./PlanMap";
import { WorkspaceNavLink } from "./WorkspaceNavLink";

const LazyPlanMap = dynamic<PlanMapProps>(() => import("./PlanMap").then((module) => module.PlanMap), { ssr: false, loading: () => <div className="planning-map-placeholder">地图准备中…</div> });

export function PlanningDesktopMap({ fullHref, ...props }: PlanMapProps & { fullHref: string }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1440px)");
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return <section className="planning-map-panel">
    <header><div><span>ATLAS</span><h2>当天地图</h2></div><WorkspaceNavLink href={fullHref}>打开完整地图 →</WorkspaceNavLink></header>
    {wide ? <LazyPlanMap {...props} compact /> : <div className="planning-map-placeholder">宽屏地图按需加载</div>}
  </section>;
}
