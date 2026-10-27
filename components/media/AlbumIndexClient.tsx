/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, MoreHorizontal, Plus } from "lucide-react";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { AlbumSummary } from "@/services/album-service.server";
import { AlbumEditor } from "./AlbumEditor";

type TripOption = { id: string; title: string };

function AlbumBookCard({ album, index, trips }: { album: AlbumSummary; index: number; trips: TripOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [editOpen, setEditOpen] = useState(false), [error, setError] = useState("");

  async function replaceCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || replacing || !album.canEditAlbum) return;
    setReplacing(true);
    setError("");
    try {
      const assetId = await uploadMediaFile(file, "album");
      const attached = await fetch(`/api/albums/${album.id}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetIds: [assetId] }) });
      if (!attached.ok) throw new Error("封面上传失败。");
      const updated = await fetch(`/api/albums/${album.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ coverMediaAssetId: assetId }) });
      if (!updated.ok) throw new Error("封面设置失败。");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "封面替换失败，请重试。");
    } finally {
      setReplacing(false);
      event.target.value = "";
    }
  }

  return <article className={`album-book album-book-tone-${index % 4}`}>
    <input ref={inputRef} className="album-book-cover-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={replaceCover} />
    <Link className="album-book-open" href={`/albums/${album.id}`}>
      <span className="album-book-spine" aria-hidden="true" />
      <span className={`album-book-image${replacing ? " is-replacing" : ""}`}>{album.coverMediaAssetId ? <img src={`/api/media/${album.coverMediaAssetId}?variant=card`} alt="" width={640} height={420} loading="lazy" /> : <span className="album-book-empty"><BookOpen size={42} /></span>}</span>
      <span className="album-book-meta"><small>{album.tripTitle || "共同相册"}</small><strong>{album.title}</strong><span>{album.photoCount} 张照片</span></span>
    </Link>
    {album.canEditAlbum && <button className="album-book-replace" type="button" disabled={replacing} aria-label={`替换${album.title}的封面`} onClick={() => inputRef.current?.click()} />}
    {error && !editOpen && <p className="form-error" role="alert">{error}</p>}
    {album.canEditAlbum && <><button className="album-book-menu-trigger" type="button" aria-label={`编辑相册：${album.title}`} aria-haspopup="dialog" aria-expanded={editOpen} onClick={() => setEditOpen(true)}><MoreHorizontal size={18} /></button>{editOpen && <AlbumEditor album={album} trips={trips} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); router.refresh(); }} />}</>}
  </article>;
}

export function AlbumIndexClient({ albums, trips }: { albums: AlbumSummary[]; trips: TripOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="global-floating-add" aria-label="添加相册" onClick={() => setOpen(true)}><Plus size={30} /></button>
    {open && <AlbumEditor trips={trips} onClose={() => setOpen(false)} onSaved={albumId => { setOpen(false); if (albumId) router.push(`/albums/${albumId}`); }} />}
    {!albums.length ? <section className="album-empty"><BookOpen size={72} strokeWidth={1.2} /><h2>暂无相册</h2></section> : <div className="album-grid album-book-grid">{albums.map((album, index) => <AlbumBookCard album={album} index={index} trips={trips} key={album.id} />)}</div>}
  </>;
}
