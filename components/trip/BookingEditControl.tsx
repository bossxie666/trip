"use client";
import { useState } from "react";
import { useClientReady } from "./useClientReady";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { DeferredEditor } from "./DeferredEditor";
import type { BookingEditorProps } from "./BookingEditor";

const loadEditor = () => import("./BookingEditor").then(module => ({ default: module.BookingEditor }));
type BookingRecord = BookingEditorProps["booking"];
export function BookingEditControl(props: BookingEditorProps) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<{ baseline: string; record: BookingRecord } | null>(null);
  const baseline = JSON.stringify(props.booking);
  const current = saved?.baseline === baseline ? saved.record : props.booking;
  const modalName = `booking-editor:${props.booking.booking.id}`;
  useExclusiveTripModal(modalName, () => setOpen(false));
  return <><div className="booking-edit-control"><button disabled={!ready} type="button" className="booking-edit-trigger button-ghost" onClick={() => { requestTripModalOpen(modalName); setOpen(true); }}>{props.booking.booking.type === "hotel" ? "编辑住宿" : "编辑交通"}</button></div>
    {open && <DeferredEditor load={loadEditor} title={props.booking.booking.type === "hotel" ? "编辑住宿" : "编辑交通"} editorProps={{ ...props, booking: current, onClose: () => setOpen(false), onSaved: record => { setSaved({ baseline, record }); setOpen(false); } }} />}</>;
}
