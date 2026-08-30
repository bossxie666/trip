"use client";

import { useEffect } from "react";

const legacyTripAnchors = new Set(["planner", "maps", "disney", "trains", "top"]);

export function LegacyTripRedirect() {
  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (legacyTripAnchors.has(anchor)) {
      window.location.replace(`/trips/shanghai-hangzhou-2026${window.location.hash}`);
    }
  }, []);

  return null;
}
