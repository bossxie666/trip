"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { Trip, TripStatus } from "@/models/travel";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";

type EditableTrip = Pick<Trip, "slug" | "title" | "status" | "startDate" | "endDate" | "cover"> & { cities: { name: string }[]; members: { id: string }[] };

export function EditTripDialog({ trip, members, canDelete, onClose }: {
  trip: EditableTrip; members: { id: string; displayName: string }[]; canDelete: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(trip.title), [status, setStatus] = useState<TripStatus>(trip.status);
  const [undated, setUndated] = useState(!trip.startDate || !trip.endDate);
  const [startDate, setStartDate] = useState(trip.startDate || ""), [endDate, setEndDate] = useState(trip.endDate || "");
  const [memberIds, setMemberIds] = useState(trip.members.map(member => member.id));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const uploadedCover = useRef<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [deleting, setDeleting] = useState(false);
  const dirty = title !== trip.title || status !== trip.status || undated !== (!trip.startDate || !trip.endDate)
    || startDate !== (trip.startDate || "") || endDate !== (trip.endDate || "") || !!coverFile
    || memberIds.length !== trip.members.length || trip.members.some(member => !memberIds.includes(member.id));

  async function save() {
    setBusy(true); setError("");
    try {
      if (deleting) {
        if (!canDelete) return;
        await editorRequest(`/api/trips/${encodeURIComponent(trip.slug)}`, { method: "DELETE" });
      } else {
        let cover = trip.cover;
        if (coverFile) {
          if (uploadedCover.current?.file !== coverFile) uploadedCover.current = {
            file: coverFile,
            url: `/api/media/${encodeURIComponent(await uploadMediaFile(coverFile, "trip_cover"))}?variant=display`,
          };
          cover = uploadedCover.current.url;
        }
        await editorRequest(`/api/trips/${encodeURIComponent(trip.slug)}`, {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, status, cities: trip.cities.map(city => city.name), undated, startDate, endDate, people: memberIds.length || 1, cover, memberIds }),
        });
      }
      onClose(); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  }

  return <EditorDialog open title={deleting ? "删除行程" : "编辑旅行"} dirty={!deleting && dirty} busy={busy}
    onClose={() => { if (deleting) setDeleting(false); else onClose(); }} onSubmit={save} submitLabel={deleting ? "确认删除" : "保存修改"}
    actions={<button type="button" className={deleting ? undefined : "danger"} disabled={busy || !canDelete} title={!canDelete ? "仅管理员可以删除行程。" : undefined}
      aria-label={deleting ? "返回编辑" : `删除行程：${trip.title}`} onClick={() => { setDeleting(!deleting); setError(""); }}>{deleting ? "返回编辑" : "删除行程"}</button>}>
    {deleting ? <p>确定删除“{trip.title}”及其行程资料吗？删除后不能恢复。</p> : <>
      <label>名称<input required value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>状态<select value={status} onChange={event => setStatus(event.target.value as TripStatus)}><option value="inspiration">灵感</option><option value="planning">待出行</option><option value="completed">已出行</option></select></label>
      <label className="inline-check"><input type="checkbox" checked={undated} onChange={event => setUndated(event.target.checked)} />日期未定</label>
      {!undated && <div className="trip-date-fields"><label>开始日期<input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label>结束日期<input type="date" required min={startDate} value={endDate} onChange={event => setEndDate(event.target.value)} /></label></div>}
      <label>行程封面<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event => setCoverFile(event.target.files?.[0] || null)} />{coverFile && <small>{coverFile.name}</small>}</label>
      <fieldset><legend>参与成员</legend><div className="participant-checkboxes">{members.map(member => <label key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={event => setMemberIds(current => event.target.checked ? [...new Set([...current, member.id])] : current.filter(id => id !== member.id))} /><span>{member.displayName}</span></label>)}</div></fieldset>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </EditorDialog>;
}
