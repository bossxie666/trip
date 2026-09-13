/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

export function RecommendationCover({ src, label, eager = false, kind = "place", category = "other" }: { src: string | null; label: string; eager?: boolean; kind?: "place" | "guide"; category?: string | null }) {
  const [failed, setFailed] = useState(false);
  const variant = kind === "guide" ? "guide" : ["food", "shopping", "attraction", "hotel"].includes(category || "") ? category : "place";
  if (!src || failed) return <div className="recommendation-cover" data-cover-state={failed ? "failed" : "fallback"} data-cover-variant={variant}><span>{label}</span><i /><b aria-hidden="true" /></div>;
  return <img src={src} alt="" loading={eager ? "eager" : "lazy"} width="640" height="480" onError={() => setFailed(true)} />;
}
