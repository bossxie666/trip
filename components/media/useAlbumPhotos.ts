"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AlbumDetail } from "@/models/album";

export function useAlbumPhotos(initial: AlbumDetail) {
  const [album, setAlbum] = useState(initial), [loading, setLoading] = useState<"" | "more" | "refresh">(""), [error, setError] = useState("");
  const current = useRef(initial), pending = useRef<AbortController | null>(null), generation = useRef(0), running = useRef(false);
  useEffect(() => () => { generation.current += 1; pending.current?.abort(); }, []);

  const load = useCallback(async (mode: "more" | "refresh" | "filter", filter?: string) => {
    if (mode === "more" && (running.current || !current.current.pagination.nextCursor)) return null;
    pending.current?.abort();
    const controller = new AbortController(), request = ++generation.current;
    pending.current = controller; running.current = true;
    setLoading(mode === "more" ? "more" : "refresh"); setError("");
    const before = current.current, activeFilter = filter ?? before.pagination.filter;
    const target = mode === "refresh" ? Math.max(60, before.photos.length) : 60;
    let cursor = mode === "more" ? before.pagination.nextCursor : null;
    const photos = mode === "more" ? [...before.photos] : [];
    const seen = new Set(photos.map(photo => photo.assetId));
    try {
      let result: AlbumDetail;
      do {
        const query = new URLSearchParams({ filter: activeFilter });
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(`/api/albums/${encodeURIComponent(initial.id)}?${query}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: "no-store" });
        const payload = await response.json() as { album?: AlbumDetail; error?: string; message?: string };
        if (!response.ok || !payload.album) throw new Error(payload.message || payload.error || "照片读取失败，请重试。");
        result = payload.album;
        for (const photo of result.photos) if (!seen.has(photo.assetId)) { seen.add(photo.assetId); photos.push(photo); }
        cursor = result.pagination.nextCursor;
      } while (mode === "refresh" && cursor && photos.length < target);
      if (request !== generation.current) return null;
      const updated = { ...result, photos };
      current.current = updated; setAlbum(updated);
      if (mode === "filter") {
        const url = new URL(window.location.href);
        if (activeFilter === "all") url.searchParams.delete("filter"); else url.searchParams.set("filter", activeFilter);
        window.history.replaceState(window.history.state, "", url);
      }
      return updated;
    } catch (caught) {
      if (request === generation.current && !controller.signal.aborted) setError(caught instanceof Error && caught.name !== "SyntaxError" ? caught.message : "照片读取失败，请重试。");
      return null;
    } finally {
      if (request === generation.current) { running.current = false; setLoading(""); }
    }
  }, [initial.id]);

  const refresh = useCallback(() => load("refresh"), [load]);
  const loadMore = useCallback(() => load("more"), [load]);
  const changeFilter = useCallback((filter: string) => load("filter", filter), [load]);
  return { album, loading, error, refresh, loadMore, changeFilter };
}
