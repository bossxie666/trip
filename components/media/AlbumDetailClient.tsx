/* eslint-disable @next/next/no-img-element */
"use client";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Heart, ImagePlus, Plus, Star, Tag, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { readPhotoCapturedAt, uploadMediaFile } from "./client-upload";
import { runAlbumUploadQueue, type AlbumUploadItem } from "./album-upload-queue";
import { WorkspaceOverlay } from "@/components/trip/WorkspaceOverlay";
import type { AlbumDetail, AlbumPhoto as Photo } from "@/models/album";
import { useAlbumPhotos } from "./useAlbumPhotos";

const dateLabel = (date: string) => { const parsed = new Date(date); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("zh-CN") : "日期未知"; };

export function AlbumDetailClient({ album: initial }: { album: AlbumDetail }) {
  const { album, loading, error: pageError, refresh, loadMore, changeFilter } = useAlbumPhotos(initial);
  const inputRef = useRef<HTMLInputElement>(null), moreRef = useRef<HTMLDivElement>(null), running = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null), pointerStart = useRef<{ x: number; y: number } | null>(null), held = useRef(false), swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [queue, setQueue] = useState<AlbumUploadItem[]>([]);
  const filter = album.pagination.filter;
  const [selecting, setSelecting] = useState(false), [selected, setSelected] = useState<Set<string>>(new Set()), [viewer, setViewer] = useState<string | null>(null);
  const [editAction, setEditAction] = useState<"tag" | "date" | null>(null), [tagName, setTagName] = useState(""), [date, setDate] = useState("");
  const visible = album.photos;
  const groups = useMemo(() => { const map = new Map<string, Photo[]>(); for (const p of visible) { const key = p.capturedAt.slice(0, 10); const group = map.get(key) || []; group.push(p); map.set(key, group); } return [...map.entries()]; }, [visible]);
  const activeIndex = viewer ? visible.findIndex(p => p.assetId === viewer) : -1, activePhoto = activeIndex >= 0 ? visible[activeIndex] : null;
  const failed = queue.filter(item => item.status === "error"), uploaded = queue.filter(item => item.status === "done").length;
  const allSelected = album.pagination.total > 0 && selected.size >= album.pagination.total && visible.every(photo => selected.has(photo.assetId));
  const dateCounts = new Map(album.pagination.dateCounts.map(group => [group.date, group.count]));
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current); }, []);
  useEffect(() => {
    const target = moreRef.current;
    if (!target || !album.pagination.nextCursor || loading || pageError || viewer || busy || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadMore(); }, { rootMargin: "400px" });
    observer.observe(target); return () => observer.disconnect();
  }, [album.pagination.nextCursor, loading, pageError, viewer, busy, loadMore]);
  async function nextPhoto() {
    if (busy || loading) return;
    if (activeIndex < visible.length - 1) setViewer(visible[activeIndex + 1].assetId);
    else if (album.pagination.nextCursor) { const updated = await loadMore(); if (updated?.photos[activeIndex + 1]) setViewer(updated.photos[activeIndex + 1].assetId); }
  }
  async function filterPhotos(nextFilter: string) {
    if (busy) return;
    setSelected(new Set()); setSelecting(false); setViewer(null);
    await changeFilter(nextFilter);
  }
  async function selectAll() {
    if (allSelected) { setSelected(new Set()); return; }
    if (running.current || loading) return;
    running.current = true; setBusy("select"); setError("");
    try {
      const response = await fetch(`/api/albums/${encodeURIComponent(album.id)}/selection?${new URLSearchParams({ filter })}`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
      const result = await response.json() as { assetIds?: string[]; error?: string; message?: string };
      if (!response.ok || !Array.isArray(result.assetIds)) throw new Error(result.message || result.error || "无法全选照片，请重试。");
      setSelected(new Set(result.assetIds));
      if (result.assetIds.length !== album.pagination.total) await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "无法全选照片，请重试。"); }
    finally { running.current = false; setBusy(""); }
  }
  useEffect(() => {
    if (!viewer) return;
    const key = (e: KeyboardEvent) => { if (busy || loading) return; if (e.key === "ArrowLeft" && activeIndex > 0) { e.preventDefault(); setViewer(visible[activeIndex - 1].assetId); } if (e.key === "ArrowRight") { e.preventDefault(); void nextPhoto(); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  async function json(url: string, init: RequestInit) {
    const response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(20000) }), payload = await response.json() as { error?: string; message?: string };
    if (!response.ok) throw new Error(payload.message || payload.error || "操作失败，请重试。"); return payload;
  }
  async function processUploads(items: AlbumUploadItem[]) {
    if (running.current) return;
    running.current = true; setBusy("upload"); setError("");
    try {
      const results = await runAlbumUploadQueue(items, {
        upload: file => uploadMediaFile(file, "album"), capturedAt: readPhotoCapturedAt, changed: setQueue,
        attach: (assetId, capturedAt) => json(`/api/albums/${album.id}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetIds: [assetId], capturedAtByAsset: capturedAt ? { [assetId]: capturedAt } : {} }) }),
      });
      const errors = results.filter(item => item.status === "error");
      if (errors.length) setError(`${errors.length} 张照片未完成，可只重试失败项。`);
      await refresh();
    } finally { running.current = false; setBusy(""); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])]; event.target.value = "";
    if (!files.length || busy) return;
    if (files.length > 20) { setError("每次最多上传 20 张照片。"); return; }
    await processUploads([...failed, ...files.map(file => ({ file, status: "waiting" as const }))]);
  }
  async function batch(action: string, extra: Record<string, unknown> = {}, ids = [...selected]) {
    if (!ids.length || running.current) return;
    running.current = true; setBusy(action); setError("");
    try {
      await json(`/api/albums/${album.id}/media/batch`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, assetIds: ids, ...extra }) });
      setSelected(new Set()); setSelecting(false); setEditAction(null);
      const updated = await refresh();
      if (viewer && updated && !updated.photos.some(photo => photo.assetId === viewer)) setViewer(updated.photos[Math.min(activeIndex, updated.photos.length - 1)]?.assetId || null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "照片操作失败。"); }
    finally { running.current = false; setBusy(""); }
  }
  async function removeSelected() {
    const ids = [...selected];
    if (!ids.length || running.current || !confirm(`确定永久删除选中的 ${ids.length} 张照片吗？删除后无法恢复。`)) return;
    running.current = true; setBusy("delete"); setError("");
    try { await json(`/api/albums/${album.id}/media/batch`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetIds: ids }) }); setSelected(new Set()); setSelecting(false); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败。"); }
    finally { running.current = false; setBusy(""); }
  }
  async function cover(id: string) {
    if (running.current || !album.canEditAlbum) return;
    running.current = true; setBusy("cover"); setError("");
    try { await json(`/api/albums/${album.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ coverMediaAssetId: id }) }); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "封面设置失败。"); }
    finally { running.current = false; setBusy(""); }
  }
  function toggle(id: string) { setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function cancelHold() { if (hold.current) clearTimeout(hold.current); hold.current = null; pointerStart.current = null; }
  function startHold(event: PointerEvent, id: string) {
    if (event.button !== 0 || busy || loading === "refresh") return;
    held.current = false; pointerStart.current = { x: event.clientX, y: event.clientY };
    hold.current = setTimeout(() => { held.current = true; setSelecting(true); setSelected(current => new Set([...current, id])); hold.current = null; }, 480);
  }
  function open(photo: Photo) { if (busy || loading === "refresh") return; if (held.current) { held.current = false; return; } if (selecting) toggle(photo.assetId); else setViewer(photo.assetId); }
  function swipeEnd(event: PointerEvent) {
    const start = swipeStart.current; swipeStart.current = null;
    if (busy || loading) return;
    if (!start) return;
    const x = event.clientX - start.x, y = event.clientY - start.y;
    if (Math.abs(x) <= Math.max(50, Math.abs(y) * 1.5)) return;
    if (x > 0 && activeIndex > 0) setViewer(visible[activeIndex - 1].assetId);
    if (x < 0) void nextPhoto();
  }
  return <>
    <nav className="album-photo-toolbar" aria-label="照片筛选"><div><button className={filter === "all" ? "active" : ""} disabled={!!busy || !!loading} onClick={() => void filterPhotos("all")}>全部</button><button className={filter === "favorite" ? "active" : ""} disabled={!!busy || !!loading} onClick={() => void filterPhotos("favorite")}><Heart size={15} />收藏</button>{album.tags.map(tag => <button className={filter === tag.id ? "active" : ""} key={tag.id} disabled={!!busy || !!loading} onClick={() => void filterPhotos(tag.id)}>{tag.name}</button>)}</div><button disabled={!!busy || !!loading} onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>{selecting ? "取消" : "选择"}</button></nav>
    {error && <p className="form-error album-error" role="alert">{error}</p>}
    {!!queue.length && <section className="album-upload-status" aria-live="polite"><p>{busy === "upload" ? `已完成 ${uploaded} / ${queue.length} 张` : `已添加 ${uploaded} 张`}</p>{failed.length > 0 && <><ul>{failed.map((item, index) => <li key={index}>{item.file.name}：{item.error}</li>)}</ul><button disabled={!!busy || !!loading} onClick={() => processUploads(queue)}>重试失败的 {failed.length} 张</button></>}{!busy && !failed.length && <button onClick={() => setQueue([])}>关闭</button>}</section>}
    {!visible.length ? <section className="album-photo-empty"><ImagePlus size={45} /><p>{album.pagination.totalPhotos ? "暂无匹配照片" : "暂无照片"}</p></section> : <div className="album-photo-timeline" aria-busy={!!loading}>{groups.map(([date, photos]) => <section key={date}><header><h2>{dateLabel(`${date}T12:00:00`)}</h2><span>{dateCounts.get(date) || photos.length} 张</span></header><div className="album-photo-grid">{photos.map(photo => <button type="button" aria-label={selecting ? `${selected.has(photo.assetId) ? "取消选择" : "选择"}${photo.filename}` : `查看${photo.filename}`} aria-pressed={selecting ? selected.has(photo.assetId) : undefined} className={`album-photo-tile${selected.has(photo.assetId) ? " selected" : ""}`} key={photo.assetId} onPointerDown={event => startHold(event, photo.assetId)} onPointerMove={event => { const start = pointerStart.current; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) cancelHold(); }} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold} onContextMenu={event => event.preventDefault()} onClick={() => open(photo)}><img src={`/api/media/${photo.assetId}?variant=thumb`} alt={photo.filename} width={320} height={320} loading="lazy" draggable={false} />{photo.isFavorite && <Heart className="album-photo-heart" size={17} fill="currentColor" />}{selecting && <i className="album-photo-check">{selected.has(photo.assetId) && <Check size={16} />}</i>}</button>)}</div></section>)}</div>}
    {pageError && <p className="form-error" role="alert">{pageError}<button type="button" disabled={!!loading} onClick={() => void refresh()}>重新加载照片</button></p>}
    <div ref={moreRef} className="album-page-loader" aria-live="polite">{loading && <span>正在读取照片…</span>}{album.pagination.nextCursor && <button type="button" disabled={!!loading || !!busy} onClick={() => void loadMore()}>加载更多 · {visible.length} / {album.pagination.total}</button>}</div>
    <input ref={inputRef} className="album-floating-input" type="file" tabIndex={-1} aria-hidden="true" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple disabled={!!busy || !!loading} onChange={upload} />{!selecting && <button type="button" className={`album-floating-add${busy === "upload" ? " busy" : ""}`} aria-label={busy === "upload" ? "照片上传中" : "添加照片"} disabled={!!busy || !!loading} onClick={() => inputRef.current?.click()}>{busy === "upload" ? <span>{uploaded}/{queue.length}</span> : <Plus size={30} />}</button>}
    {selecting && <aside className="album-selection-bar"><b>已选 {selected.size} 张</b><button disabled={!!busy || !!loading || !album.pagination.total} onClick={() => void selectAll()}>{allSelected ? "取消全选" : "全选"}</button><button disabled={!selected.size || !!busy || !!loading} onClick={() => batch("favorite", { isFavorite: true })}><Heart size={18} />收藏</button><button disabled={!selected.size || !!busy || !!loading} onClick={() => batch("favorite", { isFavorite: false })}>取消收藏</button><button disabled={!selected.size || !!busy || !!loading} onClick={() => setEditAction("tag")}><Tag size={18} />标签</button>{album.canEditAlbum && <><button disabled={!selected.size || !!busy || !!loading} onClick={() => setEditAction("date")}>日期</button><button className="danger" disabled={!selected.size || !!busy || !!loading} onClick={removeSelected}><Trash2 size={18} />删除</button></>}</aside>}
    <WorkspaceOverlay open={editAction !== null} onClose={() => !busy && setEditAction(null)} ariaLabel={editAction === "tag" ? "管理照片标签" : "修改拍摄日期"} className="clean-dialog album-action-dialog"><header className="editor-dialog-heading"><h2>{editAction === "tag" ? "管理照片标签" : "修改拍摄日期"}</h2><button disabled={!!busy || !!loading} aria-label="关闭" onClick={() => setEditAction(null)}><X size={20} /></button></header>{editAction === "tag" ? <div><label>添加标签<input maxLength={24} value={tagName} onChange={event => setTagName(event.target.value)} /></label><button disabled={!!busy || !tagName.trim()} onClick={() => batch("addTag", { tagName: tagName.trim() })}>添加到选中照片</button><p>移除标签</p>{album.tags.map(tag => <button key={tag.id} disabled={!!busy || !!loading} onClick={() => batch("removeTag", { tagId: tag.id })}>{tag.name} ×</button>)}</div> : <form onSubmit={event => { event.preventDefault(); if (date) void batch("date", { capturedAt: `${date}T12:00:00` }); }}><label>拍摄日期<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label><button disabled={!!busy || !date}>保存</button></form>}{error && <p role="alert">{error}</p>}</WorkspaceOverlay>
    <WorkspaceOverlay open={!!activePhoto} onClose={() => setViewer(null)} ariaLabel="照片预览" className="album-viewer">{activePhoto && <><button className="album-viewer-close" aria-label="关闭" onClick={() => setViewer(null)}><X /></button><img src={`/api/media/${activePhoto.assetId}?variant=display`} alt={activePhoto.filename} onPointerDown={event => { swipeStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={swipeEnd} onPointerCancel={() => { swipeStart.current = null; }} draggable={false} /><button className="album-viewer-prev" aria-label="上一张" disabled={!!busy || !!loading || activeIndex <= 0} onClick={() => setViewer(visible[activeIndex - 1].assetId)}><ChevronLeft /></button><button className="album-viewer-next" aria-label="下一张" disabled={!!loading || (activeIndex >= visible.length - 1 && !album.pagination.nextCursor)} onClick={() => void nextPhoto()}><ChevronRight /></button><footer><div className="album-viewer-info"><span>{activeIndex + 1} / {album.pagination.total}</span><time dateTime={activePhoto.capturedAt}>{dateLabel(activePhoto.capturedAt)}</time><span className="album-viewer-tags">{album.tags.filter(tag => activePhoto.tagIds.includes(tag.id)).map(tag => `#${tag.name}`).join(" ")}</span></div><button disabled={!!busy || !!loading} className={activePhoto.isFavorite ? "active" : ""} onClick={() => batch("favorite", { isFavorite: !activePhoto.isFavorite }, [activePhoto.assetId])}><Heart fill={activePhoto.isFavorite ? "currentColor" : "none"} />{activePhoto.isFavorite ? "取消收藏" : "收藏"}</button>{album.canEditAlbum && <button disabled={!!busy || !!loading} onClick={() => cover(activePhoto.assetId)}><Star fill={album.coverMediaAssetId === activePhoto.assetId ? "currentColor" : "none"} />设为封面</button>}</footer>{(error || pageError) && <p className="album-viewer-error" role="alert">{error || pageError}</p>}</>}</WorkspaceOverlay>
  </>;
}
