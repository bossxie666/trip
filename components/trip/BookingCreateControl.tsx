"use client";
import { useState } from "react";
import { useClientReady } from "./useClientReady";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { DeferredEditor } from "./DeferredEditor";
import type { BookingCreateEditorProps } from "./BookingCreateEditor";

const loadEditor = () => import("./BookingCreateEditor").then(module => ({ default: module.BookingCreateEditor }));

/** Accommodation creation only; transport keeps its existing entry. */
export function BookingCreateControl(props: Omit<BookingCreateEditorProps, "onClose">) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const modalOwner = `accommodation-create:${props.slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  return <>
    <button disabled={!ready} type="button" className="booking-add-button button-primary" onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>＋ 添加住宿</button>
    {open && <DeferredEditor load={loadEditor} title="添加住宿" editorProps={{ ...props, onClose: () => setOpen(false) }} />}
  </>;
}
