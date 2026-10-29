"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

export type PlanAddControlProps = {
  slug: string; days: { id: string; label: string }[]; defaultDayId: string;
  currentMemberId?: string | null; members?: { id: string; displayName: string }[];
  existingPlaces?: GenericPlaceChoice[];
  existingTransport?: { id: string; title: string; origin: GenericPlaceChoice | null; destination: GenericPlaceChoice | null; type: string; totalAmountMinor: number | null }[];
};
const PlanAddEditor = dynamic(() => import("./PlanAddEditor").then(module => module.PlanAddEditor), { ssr: false });

export function PlanAddControl(props: PlanAddControlProps) {
  const [open, setOpen] = useState(false);
  const { openPlanningDay } = useWorkspaceNavigation();
  const { slug } = props;
  const modalOwner = `plan-add:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));
  return <>
    <button type="button" aria-label="＋ 添加行程" className="add-itinerary-button button-primary" onClick={() => { requestTripModalOpen(modalOwner); setOpen(true); }}>＋ 添加行程</button>
    {open && <PlanAddEditor {...props} onClose={() => setOpen(false)} onSaved={dayId => { setOpen(false); openPlanningDay(slug, dayId); }} />}
  </>;
}
