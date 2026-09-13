/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import type { AlbumSummary } from "@/services/album-service.server";

type TripOption = { id: string; title: string };
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
    {!albums.length ? <section className="album-empty"><BookOpen size={72} strokeWidth={1.2} /><h2>相册还是空白的</h2><p>打开一本新的旅行影集，把照片慢慢放进去。</p><button type="button" onClick={() => setOpen(true)}><Plus size={18} />添加相册</button></section> : <div className="album-grid">{albums.map((album) => <Link className="album-card" href={`/albums/${album.id}`} key={album.id}>{album.coverMediaAssetId ? <img src={`/api/media/${album.coverMediaAssetId}?variant=card`} alt="" width={640} height={420} loading="lazy" /> : <div className="album-card-empty"><BookOpen size={42} /></div>}<div><span>{album.tripTitle || "共同相册"}</span><h2>{album.title}</h2><p>{album.description || "等待第一段照片故事。"}</p><small>{album.photoCount} 张照片</small></div></Link>)}</div>}
  </>;
}
