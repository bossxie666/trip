"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

export type PlaceDiscoveryProps = { slug: string; days: { id: string; label: string }[]; defaultDayId?: string; existingPlaces?: GenericPlaceChoice[] };
const PlaceDiscoveryEditor = dynamic(() => import("./PlaceDiscoveryEditor").then(module => module.PlaceDiscoveryEditor), { ssr: false });

export function PlaceDiscoveryControl(props: PlaceDiscoveryProps) {
  const [open, setOpen] = useState(false);
  const { refreshWorkspace, openPlanningDay } = useWorkspaceNavigation();
  const { slug } = props;
  const modalOwner = `place-discovery:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  return <>
    <button type="button" aria-label="找想去的地方" className="add-itinerary-button button-primary" onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>找想去的地方</button>
    {open && <PlaceDiscoveryEditor {...props} onClose={() => setOpen(false)} onSaved={(mode, dayId) => { setOpen(false); if (mode === "day") openPlanningDay(slug, dayId); else refreshWorkspace(); }} />}
  </>;
}
