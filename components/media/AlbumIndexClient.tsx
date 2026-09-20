/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { AlbumSummary } from "@/services/album-service.server";

type TripOption = { id: string; title: string };

function AlbumBookCard({ album, index }: { album: AlbumSummary; index: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);

  async function replaceCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    try {
      const assetId = await uploadMediaFile(file, "album");
      const attached = await fetch(`/api/albums/${album.id}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetIds: [assetId] }) });
      if (!attached.ok) throw new Error("封面上传失败。");
      const updated = await fetch(`/api/albums/${album.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ coverMediaAssetId: assetId }) });
      if (!updated.ok) throw new Error("封面设置失败。");
      router.refresh();
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
    <button className="album-book-replace" type="button" aria-label={`替换${album.title}的封面`} onClick={() => inputRef.current?.click()} />
  </article>;
}

export function AlbumIndexClient({ albums, trips }: { albums: AlbumSummary[]; trips: TripOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [title, setTitle] = useState(""), [description, setDescription] = useState(""), [tripId, setTripId] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/albums", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description, tripId: tripId || null }) });
      const payload = await response.json() as { album?: { id: string }; error?: string };
      if (!response.ok || !payload.album) throw new Error(payload.error || "相册创建失败。");
      router.push(`/albums/${payload.album.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "相册创建失败。"); }
    finally { setSaving(false); }
  }
  return <>
    <div className="album-index-actions"><button type="button" onClick={() => setOpen((value) => !value)}><Plus size={18} />添加相册</button></div>
    {open && <form className="album-form" onSubmit={submit}><label>相册标题<input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>关联旅行（可选）<select value={tripId} onChange={(event) => setTripId(event.target.value)}><option value="">不关联旅行 · 全员共同相册</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label><label>简介<textarea maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<div><button type="button" onClick={() => setOpen(false)}>取消</button><button type="submit" disabled={saving}>{saving ? "创建中…" : "创建相册"}</button></div></form>}
    {!albums.length ? <section className="album-empty"><BookOpen size={72} strokeWidth={1.2} /><h2>暂无相册</h2><button type="button" onClick={() => setOpen(true)}><Plus size={18} />添加相册</button></section> : <div className="album-grid album-book-grid">{albums.map((album, index) => <AlbumBookCard album={album} index={index} key={album.id} />)}</div>}
  </>;
}
