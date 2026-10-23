"use client";
/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- Full-document links preserve the selected workspace when returning. */

import { useId, useRef, useState } from "react";
import { Camera, Plus, X } from "lucide-react";
import type { AtlasPhotoSlot } from "@/services/home-media";
import styles from "./home-live.module.css";

type Album = { id: string; title: string };
type Photo = { assetId: string; filename: string };

export function HomePhotoPicker({ slot, selectedIds = [] }: { slot: AtlasPhotoSlot | "wall"; selectedIds?: string[] }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestNumber = useRef(0);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [selection, setSelection] = useState(selectedIds);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isWall = slot === "wall";

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
    setSelection(selectedIds); setError(""); setLoading(true); setPhotos([]); setAlbumId("");
    if (!dialog.current?.open) dialog.current?.showModal();
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
  function close() { requestNumber.current++; dialog.current?.close(); }
  function choose(id: string) {
    setError("");
    if (!isWall) { setSelection([id]); return; }
    setSelection((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 9 ? [...current, id] : current);
  }
  async function save(clear = false) {
    setSaving(true); setError("");
    try {
      await readJson(await fetch("/api/home/featured-photos", {
        method: clear ? "DELETE" : "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify(clear ? { slotKey: slot } : isWall ? { slotKey: "wall", assetIds: selection } : { slotKey: slot, assetId: selection[0] }),
        signal: AbortSignal.timeout(12_000),
      }));
      window.location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "照片保存失败，请重试。"); setSaving(false); }
  }

  return <>
    <button type="button" className={styles.photoTrigger} onClick={() => void show()} aria-label={isWall ? "选择精选照片" : "从相册选择地图照片"}>{isWall ? <Plus size={18} /> : <><Camera size={13} />换照片</>}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { if (saving) event.preventDefault(); else requestNumber.current++; }}>
      <header className={styles.dialogHeader}><h2 id={titleId}>{isWall ? "选择精选照片" : "选择地图照片"}</h2><button type="button" disabled={saving} onClick={close} aria-label="关闭照片选择"><X size={22} /></button></header>
      <div className={styles.photoBody}>
        {!!albums.length && <label>相册 <select disabled={saving} value={albumId} onChange={(event) => void loadAlbum(event.target.value)}>{albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></label>}
        {loading && <p role="status">正在读取相册…</p>}
        {error && <p className={styles.error} role="alert">{error}<button type="button" onClick={() => void (albumId ? loadAlbum(albumId) : show())}>重试</button></p>}
        {!loading && !error && !albums.length && <p>还没有相册。<a href="/albums">打开相册上传照片</a></p>}
        {!loading && !error && !!albums.length && !photos.length && <p>这个相册还没有照片。<a href={`/albums/${encodeURIComponent(albumId)}`}>打开相册</a></p>}
        <div className={styles.photoGrid}>{photos.map((photo) => <button key={photo.assetId} type="button" disabled={saving || isWall && selection.length >= 9 && !selection.includes(photo.assetId)} aria-label={photo.filename} aria-pressed={selection.includes(photo.assetId)} onClick={() => choose(photo.assetId)}><img src={`/api/media/${encodeURIComponent(photo.assetId)}?variant=thumb`} alt={photo.filename} />{selection.includes(photo.assetId) && <span>{isWall ? selection.indexOf(photo.assetId) + 1 : "已选"}</span>}</button>)}</div>
        <footer className={styles.photoFooter}>{isWall && <span>已选 {selection.length}/9</span>}{!isWall && !!selectedIds.length && <button type="button" disabled={saving} onClick={() => void save(true)}>移除地图照片</button>}<button type="button" disabled={saving || loading || !isWall && !selection.length} onClick={() => void save()}>{saving ? "保存中…" : "保存选择"}</button></footer>
      </div>
    </dialog>
  </>;
}
