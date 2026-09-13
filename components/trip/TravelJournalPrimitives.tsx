import type { ReactNode } from "react";

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

export function CoordinateLabel({ children }: { children: ReactNode }) {
  return <span className="coordinate-label">{children}</span>;
}

export function TapeAccent({ tone = "blue" }: { tone?: "blue" | "green" | "red" }) {
  return <i className={`tape-accent tape-accent-${tone}`} aria-hidden="true" />;
}

export function RouteSketch({ count = 3 }: { count?: number }) {
  return <span className="route-sketch" aria-hidden="true">{Array.from({ length: count }, (_, index) => <i key={index}>{String(index + 1).padStart(2, "0")}</i>)}</span>;
}

export function DateStamp({ children }: { children: ReactNode }) {
  return <span className="date-stamp">{children}</span>;
}
