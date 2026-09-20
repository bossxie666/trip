/* eslint-disable @next/next/no-img-element */
"use client";

import { MoreHorizontal, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { TripStatus } from "@/models/travel";
import { TripDeleteButton } from "./TripDeleteButton";

type Props = {
  trip: { slug: string; title: string; cover: string | null; status: TripStatus; statusLabel: string; participantSummary: string; cities: string[]; startDate: string | null; endDate: string | null; people: number; memberIds: string[] };
  index: number;
  canDelete: boolean;
};

export function TripBookCard({ trip, index, canDelete }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef({ x: 0, y: 0 });
  const coverInputRef = useRef<HTMLInputElement>(null);
  const href = `/trips/${trip.slug}/plan`;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  function clearPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  function beginPress(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === "mouse") return;
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    clearPress();
    pressTimer.current = setTimeout(() => { setMenuOpen(true); pressTimer.current = null; }, 520);
  }

  function movePress(event: PointerEvent<HTMLAnchorElement>) {
    if (Math.hypot(event.clientX - pressOrigin.current.x, event.clientY - pressOrigin.current.y) > 10) clearPress();
  }

  function openBook(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if ((event.target as HTMLElement).closest(".trip-book-image")) {
      coverInputRef.current?.click();
      return;
    }
    if (menuOpen) { setMenuOpen(false); return; }
    router.push(href);
  }

  async function replaceCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    try {
      const assetId = await uploadMediaFile(file, "trip_cover");
      const cover = `/api/media/${encodeURIComponent(assetId)}?variant=display`;
      const response = await fetch(`/api/trips/${trip.slug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: trip.title, status: trip.status, cities: trip.cities, undated: !trip.startDate || !trip.endDate, startDate: trip.startDate || "", endDate: trip.endDate || "", people: trip.people, cover, memberIds: trip.memberIds }) });
      if (!response.ok) throw new Error("封面替换失败。");
      router.refresh();
    } finally {
      setReplacing(false);
      event.target.value = "";
    }
  }

  const cover = trip.cover === "/og.png" ? "/og-card.jpg" : trip.cover;
  return <article className={`trip-book-card trip-book-tone-${index % 4}`}>
    <input ref={coverInputRef} className="trip-book-cover-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={replaceCover} />
    <a className={`trip-book-cover${replacing ? " is-replacing" : ""}`} href={href} onClick={openBook} onPointerDown={beginPress} onPointerMove={movePress} onPointerUp={clearPress} onPointerCancel={clearPress} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
      <span className="trip-book-spine" aria-hidden="true" />
      <span className="trip-book-image">{cover ? <img src={cover} alt="" width={640} height={480} loading={index < 4 ? "eager" : "lazy"} /> : <span className="trip-book-empty">NO COVER</span>}</span>
      <span className="trip-book-status">{trip.statusLabel}</span>
      <span className="trip-book-meta"><strong>{trip.title}</strong><small><Users size={14} />{trip.participantSummary}</small></span>
      <i className="trip-book-mark" aria-hidden="true" />
    </a>
    <div className="trip-book-menu" ref={menuRef}>
      <button className="trip-book-menu-trigger" type="button" aria-label={`管理行程：${trip.title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={18} /></button>
      {menuOpen && <div className="trip-book-menu-popover" role="menu"><a role="menuitem" href={`${href}?settings=open`}>编辑旅行</a><TripDeleteButton slug={trip.slug} title={trip.title} canDelete={canDelete} /></div>}
    </div>
  </article>;
}
