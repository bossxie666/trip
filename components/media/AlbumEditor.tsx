"use client";

import { useState } from "react";
import { EditorDialog } from "@/components/trip/EditorDialog";
import { editorRequest } from "@/components/trip/editor-request";

type AlbumFields = { id: string; title: string; description: string | null; tripId: string | null; photoCount: number };

// Mounted only while open so discarded input never replaces refreshed album data.
export function AlbumEditor({ album, trips, onClose, onSaved }: {
  album?: AlbumFields;
  trips: { id: string; title: string }[];
  onClose: () => void;
  onSaved: (albumId?: string) => void;
}) {
  const [title, setTitle] = useState(album?.title ?? "");
  const [description, setDescription] = useState(album?.description ?? "");
  const [tripId, setTripId] = useState(album?.tripId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const dirty = title !== (album?.title ?? "") || description !== (album?.description ?? "") || tripId !== (album?.tripId ?? "");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (deleting && album) {
        await editorRequest(`/api/albums/${album.id}`, { method: "DELETE" });
        onSaved();
      } else {
        const payload = await editorRequest<{ album?: { id: string } }>(album ? `/api/albums/${album.id}` : "/api/albums", {
          method: album ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, description, tripId: tripId || null }),
        });
        if (!album && !payload.album?.id) throw new Error("相册创建结果异常，请重试。");
        onSaved(album ? undefined : payload.album!.id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "相册操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return <EditorDialog open title={deleting ? "删除相册" : album ? "编辑相册" : "添加相册"} onClose={() => { if (deleting) setDeleting(false); else onClose(); }}
    dirty={!deleting && dirty} busy={busy} onSubmit={submit} submitLabel={deleting ? "确认删除" : album ? "保存" : "创建相册"}
    actions={album && <button type="button" className={deleting ? undefined : "danger"} disabled={busy} onClick={() => { setDeleting(!deleting); setError(""); }}>{deleting ? "返回编辑" : "删除相册"}</button>}>
    {deleting ? <p>确定删除相册“{album!.title}”（{album!.photoCount} 张照片）吗？删除后将不再显示在相册列表中。</p> : <>
      <label>{album ? "标题" : "相册标题"}<input required maxLength={80} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>关联旅行<select value={tripId} onChange={event => setTripId(event.target.value)}><option value="">不关联旅行 · 全员共同相册</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
      <label>简介<textarea maxLength={500} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </EditorDialog>;
}
