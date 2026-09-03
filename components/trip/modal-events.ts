"use client";

import { useEffect } from "react";

const EVENT_NAME = "trip:modal-open";

/** Notify sibling editors that this main modal is now the sole owner. */
export function requestTripModalOpen(owner: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: owner }));
}

/** Close this editor whenever another mutually-exclusive editor opens. */
export function useExclusiveTripModal(owner: string, close: () => void) {
  useEffect(() => {
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== owner) close();
    };
    window.addEventListener(EVENT_NAME, onOpen);
    return () => window.removeEventListener(EVENT_NAME, onOpen);
  }, [close, owner]);
}
