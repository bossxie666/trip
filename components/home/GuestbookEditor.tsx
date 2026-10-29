"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { uploadMediaFile } from "@/components/media/client-upload";
import { EditorDialog } from "@/components/trip/EditorDialog";
import { editorRequest } from "@/components/trip/editor-request";
import type { GuestbookMessageView } from "@/services/guestbook-service.server";

// Mounted on demand so closing never leaves an unsaved draft in a card.
export function GuestbookEditor({ message, initialDelete = false, onClose, onSaved, onDeleted }: {
  message?: GuestbookMessageView; initialDelete?: boolean; onClose: () => void;
  onSaved: (message: GuestbookMessageView) => void; onDeleted: (id: string) => void;
}) {
  const [body, setBody] = useState(message?.body ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [progress, setProgress] = useState(""), [deleting, setDeleting] = useState(initialDelete);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploaded = useRef(new Map<File, string>());
  const dirty = body !== (message?.body ?? "") || files.length > 0;

  async function submit() {
    setBusy(true); setError("");
    try {
      if (deleting && message) {
        await editorRequest(`/api/guestbook/${encodeURIComponent(message.id)}`, { method: "DELETE" });
        onDeleted(message.id);
        return;
      }
      if (!body.trim() && !files.length && !message?.media.length) throw new Error("请填写留言或添加图片。");
      const mediaAssetIds: string[] = [];
      for (const [index, file] of files.entries()) {
        setProgress(`上传图片 ${index + 1}/${files.length}`);
        let id = uploaded.current.get(file);
        if (!id) { id = await uploadMediaFile(file, "guestbook"); uploaded.current.set(file, id); }
        mediaAssetIds.push(id);
      }
      setProgress("保存中…");
      const result = await editorRequest<{ message?: GuestbookMessageView }>(message ? `/api/guestbook/${encodeURIComponent(message.id)}` : "/api/guestbook", {
        method: message ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(message ? { body } : { body, mediaAssetIds }),
      });
      if (!result.message) throw new Error("留言保存结果异常，请重试。");
      onSaved(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "留言操作失败，请重试。");
    } finally { setBusy(false); setProgress(""); }
  }

  return <EditorDialog open title={deleting ? "删除留言" : message ? "编辑留言" : "写下留言"}
    dirty={!deleting && dirty} busy={busy} onSubmit={submit} submitLabel={deleting ? "确认删除" : "保存"}
    onClose={() => { if (deleting) { setDeleting(false); setError(""); } else onClose(); }}
    actions={message && <button type="button" className={deleting ? undefined : "danger"} disabled={busy} onClick={() => { setDeleting(!deleting); setError(""); }}>{deleting ? "返回编辑" : "删除留言"}</button>}>
    {deleting ? <p>确定删除这条留言吗？删除后将不再显示在留言板中。</p> : <>
      <label>留言内容<textarea rows={5} value={body} maxLength={1000} onChange={event => setBody(event.target.value)} /></label>
      {!message && <>
        <input ref={inputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (selected.length > 3) { setError("一次最多添加 3 张图片。"); return; }
          setFiles(selected); setError("");
        }} />
        <button type="button" className="guestbook-attachment-button" onClick={() => inputRef.current?.click()}><ImagePlus size={16} />添加图片{files.length ? `（${files.length}/3）` : ""}</button>
        {files.length > 0 && <ul className="guestbook-attachments">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}</ul>}
      </>}
    </>}
    {progress && <p role="status">{progress}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </EditorDialog>;
}
