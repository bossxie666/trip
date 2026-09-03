/**
 * The small part of the AMap browser API used by both map components.
 * Keeping the declaration in one module prevents each component from
 * installing an incompatible `Window.AMap` type during a full type check.
 */
export type AMapObject = {
  add(value: unknown): void;
  remove(value: unknown): void;
  setFitView(value?: unknown[]): void;
  setCenter?(value: [number, number]): void;
  getBounds?(): { getSouthWest?: () => { lng: number; lat: number }; getNorthEast?: () => { lng: number; lat: number } };
  on(event: string, handler: (event?: unknown) => void): void;
  off(event: string, handler: (event?: unknown) => void): void;
  destroy(): void;
};

export type AMapMarker = { on?(event: string, handler: () => void): void };

export type AMapNamespace = {
  Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapObject;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Polyline: new (options: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: { serviceHost: string };
  }
}
