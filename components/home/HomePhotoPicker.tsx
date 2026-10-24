"use client";
/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- Full-document links preserve the selected workspace when returning. */

import { useEffect, useId, useRef, useState } from "react";
import { Camera, Plus, X } from "lucide-react";
import type { AtlasPhotoSlot } from "@/services/home-media";
import styles from "./home-live.module.css";

type Album = { id: string; title: string };
type Photo = { assetId: string; filename: string };

function PhotoChoice({ photo, selected, selectedLabel, disabled, onChoose }: { photo: Photo; selected: boolean; selectedLabel: string; disabled: boolean; onChoose(): void }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = `/api/media/${encodeURIComponent(photo.assetId)}?variant=thumb${attempt ? `&retry=${attempt}` : ""}`;
  return <button type="button" disabled={disabled} aria-label={failed ? `重新加载 ${photo.filename}` : photo.filename} aria-pressed={selected} onClick={() => {
    // Retrying a thumbnail must never select or save an unseen photograph.
    if (failed) { setFailed(false); setAttempt((value) => value + 1); }
    else onChoose();
  }}>
    {failed ? <em className={styles.photoLoadError}>照片暂时无法读取<br />点击重新加载</em> : <img key={source} src={source} alt={photo.filename} loading="lazy" decoding="async" onError={() => {
      // One automatic retry only. Persistent failures expose an explicit retry
      // rather than looping requests or leaving a broken image indefinitely.
      if (attempt === 0) setAttempt(1);
      else setFailed(true);
    }} />}
    {selected && <span>{selectedLabel}</span>}
  </button>;
}

export function HomePhotoPicker({ slot, selectedIds = [], className = "" }: { slot: AtlasPhotoSlot | "wall"; selectedIds?: string[]; className?: string }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestNumber = useRef(0);
  const ownsHistory = useRef(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [selection, setSelection] = useState(selectedIds);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isWall = slot === "wall";
  useEffect(() => {
    const invalidateRequest = () => { requestNumber.current++; };
    const onBack = () => {
      if (ownsHistory.current && history.state?.tripPhotoSlot !== slot) {
        ownsHistory.current = false;
        requestNumber.current++;
        dialog.current?.close();
      }
    };
    window.addEventListener("popstate", onBack);
    return () => { invalidateRequest(); window.removeEventListener("popstate", onBack); };
  }, [slot]);

  async function readJson(response: Response) {
    if (response.status === 401) throw new Error("登录已过期，请重新登录后选择照片。");
    const payload = await response.json() as { error?: string; albums?: Album[]; album?: { photos?: Photo[] } };
    if (!response.ok) throw new Error(payload.error || "照片加载失败，请重试。");
    return payload;
  }
  async function loadAlbum(id: string) {
    const number = ++requestNumber.current;
    setAlbumId(id); setLoading(true); setError(""); setPhotos([]);
    try {
      const payload = await readJson(await fetch(`/api/albums/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10_000) }));
      if (number === requestNumber.current) setPhotos(payload.album?.photos || []);
    } catch (caught) {
      if (number === requestNumber.current) setError(caught instanceof Error ? caught.message : "照片加载失败，请重试。");
    } finally { if (number === requestNumber.current) setLoading(false); }
  }
  async function show() {
    if (saving) return;
    setSelection(selectedIds); setError(""); setLoading(true); setPhotos([]); setAlbumId("");
    if (!dialog.current?.open) {
      history.pushState({ ...history.state, tripPhotoSlot: slot }, "", `${location.pathname}${location.search}#photos-${slot}`);
      ownsHistory.current = true;
      dialog.current?.showModal();
    }
    const number = ++requestNumber.current;
    try {
      const payload = await readJson(await fetch("/api/albums", { signal: AbortSignal.timeout(10_000) }));
      if (number !== requestNumber.current) return;
      const list: Album[] = payload.albums || [];
      setAlbums(list);
      if (list.length) await loadAlbum(list[0].id);
      else setLoading(false);
    } catch (caught) { if (number === requestNumber.current) { setError(caught instanceof Error ? caught.message : "相册加载失败。"); setLoading(false); } }
  }
  function close() {
    if (saving) return;
    requestNumber.current++;
    if (ownsHistory.current && history.state?.tripPhotoSlot === slot) history.back();
    else dialog.current?.close();
  }
  function choose(id: string) {
    setError("");
    if (!isWall) { setSelection([id]); return; }
    setSelection((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 9 ? [...current, id] : current);
  }
  async function save(clear = false) {
    if (saving) return;
    setSaving(true); setError("");
    try {
      await readJson(await fetch("/api/home/featured-photos", {
        method: clear ? "DELETE" : "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify(clear ? { slotKey: slot } : isWall ? { slotKey: "wall", assetIds: selection } : { slotKey: slot, assetId: selection[0] }),
        signal: AbortSignal.timeout(12_000),
      }));
      if (dialog.current?.open) {
        const state = { ...history.state };
        delete state.tripPhotoSlot;
        ownsHistory.current = false;
        history.replaceState(state, "", `${location.pathname}${location.search}`);
        window.location.reload();
      } else setSaving(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "照片保存失败，请重试。"); setSaving(false); }
  }

  return <>
    <button type="button" className={`${isWall ? styles.wallTrigger : styles.photoTrigger} ${className}`} onClick={() => void show()} aria-label={isWall ? "选择精选照片" : "从相册选择地图照片"}>{isWall ? <Plus size={25} /> : <><Camera size={13} />换照片</>}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }}>
      <header className={styles.dialogHeader}><h2 id={titleId}>{isWall ? "选择精选照片" : "选择地图照片"}</h2><button type="button" disabled={saving} onClick={close} aria-label="关闭照片选择"><X size={22} /></button></header>
      <div className={styles.photoBody}>
        {!!albums.length && <label>相册 <select disabled={saving} value={albumId} onChange={(event) => void loadAlbum(event.target.value)}>{albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></label>}
        {loading && <p role="status">正在读取相册…</p>}
        {error && <p className={styles.error} role="alert">{error}<button type="button" onClick={() => void (albumId ? loadAlbum(albumId) : show())}>重试</button></p>}
        {!loading && !error && !albums.length && <p>还没有相册。<a href="/albums">打开相册上传照片</a></p>}
        {!loading && !error && !!albums.length && !photos.length && <p>这个相册还没有照片。<a href={`/albums/${encodeURIComponent(albumId)}`}>打开相册</a></p>}
        <div className={styles.photoGrid}>{photos.map((photo) => <PhotoChoice key={photo.assetId} photo={photo} disabled={saving || isWall && selection.length >= 9 && !selection.includes(photo.assetId)} selected={selection.includes(photo.assetId)} selectedLabel={isWall ? String(selection.indexOf(photo.assetId) + 1) : "已选"} onChoose={() => choose(photo.assetId)} />)}</div>
        <footer className={styles.photoFooter}>{isWall && <span>已选 {selection.length}/9</span>}{!isWall && !!selectedIds.length && <button type="button" disabled={saving} onClick={() => void save(true)}>移除地图照片</button>}<button type="button" disabled={saving || loading || !isWall && !selection.length} onClick={() => void save()}>{saving ? "保存中…" : "保存选择"}</button></footer>
      </div>
    </dialog>
  </>;
}
