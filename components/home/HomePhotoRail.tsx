"use client";

/* eslint-disable @next/next/no-img-element */
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";

export type HomePhotoRailItem = {
  id: string;
  src: string;
  alt: string;
  label: string;
  frame: string;
};

type DragState = { pointerId: number; startX: number; scrollLeft: number };

/**
 * Presentation-only rail for real Homepage Featured photos. It deliberately
 * receives already-authorized media URLs from the server and never creates or
 * reorders a Photo Library record.
 */
export function HomePhotoRail({ items }: { items: HomePhotoRailItem[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const hasRail = items.length >= 4;

  function scrollBy(direction: number) {
    railRef.current?.scrollBy({ left: direction * Math.max(240, railRef.current.clientWidth * 0.58), behavior: "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!hasRail) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); scrollBy(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); scrollBy(1); }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!hasRail || event.pointerType === "mouse" && event.button !== 0 || !railRef.current) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: railRef.current.scrollLeft };
    railRef.current.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !railRef.current) return;
    railRef.current.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  }

  function stopDragging(event?: ReactPointerEvent<HTMLDivElement>) {
    if (event && dragRef.current && railRef.current?.hasPointerCapture(event.pointerId)) railRef.current.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  return <div className={`home-photo-rail-shell${hasRail ? " has-rail" : ""}`}>
    {hasRail ? <button className="home-photo-rail-control home-photo-rail-control-prev" type="button" aria-label="查看上一组精选照片" onClick={() => scrollBy(-1)}><ChevronLeft size={22} /></button> : null}
    <div
      ref={railRef}
      className={`home-photo-strip${items.length <= 2 ? " home-photo-strip-sparse" : ""}${hasRail ? " is-rail" : ""}${dragging ? " is-dragging" : ""}`}
      tabIndex={hasRail ? 0 : -1}
      role={hasRail ? "region" : undefined}
      aria-label={hasRail ? "横向精选旅行照片墙" : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      {items.map((item, index) => <figure key={item.id} className={`home-photo-card home-photo-card-${index % 4}`}>
        <div className="home-photo-polaroid">
          <img className="home-photo-image" src={item.src} alt={item.alt} width={520} height={380} loading={index < 3 ? "eager" : "lazy"} />
          <img className="home-photo-frame" src={item.frame} alt="" aria-hidden="true" />
        </div>
        <figcaption><b>{item.label}</b></figcaption>
      </figure>)}
      {items.length <= 2 ? <Link className="home-photo-manage-card" href="/albums" aria-label="打开相册添加精选照片"><span className="home-photo-manage-icon" aria-hidden="true"><Plus size={25} /></span></Link> : null}
      {!items.length ? <div className="home-photo-wall-empty">为行程添加照片后，影像会在这里排成一面旅行墙。</div> : null}
    </div>
    {hasRail ? <button className="home-photo-rail-control home-photo-rail-control-next" type="button" aria-label="查看下一组精选照片" onClick={() => scrollBy(1)}><ChevronRight size={22} /></button> : null}
  </div>;
}
