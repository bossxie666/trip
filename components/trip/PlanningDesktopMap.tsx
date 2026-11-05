"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { PlanMapProps } from "./PlanMap";
import { WorkspaceNavLink } from "./WorkspaceNavLink";

const LazyPlanMap = dynamic<PlanMapProps>(() => import("./PlanMap").then((module) => module.PlanMap), { ssr: false, loading: () => <div className="planning-map-placeholder">地图准备中…</div> });

export function PlanningDesktopMap({ fullHref, ...props }: PlanMapProps & { fullHref: string }) {
  const placeholder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    });
    if (placeholder.current) observer.observe(placeholder.current);
    return () => observer.disconnect();
  }, []);
  return <section className="planning-map-panel">
    <header><div><span>ATLAS</span><h2>当天地图</h2></div><WorkspaceNavLink href={fullHref}>打开完整地图 →</WorkspaceNavLink></header>
    {visible ? <LazyPlanMap {...props} compact /> : <div ref={placeholder} className="planning-map-placeholder">地图准备中…</div>}
  </section>;
}
