"use client";

import { useRef, useState } from "react";
import { uploadMediaFile } from "@/components/media/client-upload";

export function HomeFeaturedPhotoEditor({ slotKey, hasPhoto }: { slotKey: "map_primary" | "map_secondary"; hasPhoto: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function replace(file: File) {
    setBusy(true); setError("");
    try {
      const assetId = await uploadMediaFile(file, "home_featured");
      const response = await fetch("/api/home/featured-photos", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slotKey, assetId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "照片替换失败。");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "照片替换失败。");
    } finally { setBusy(false); }
  }
  return <div className="home-photo-editor">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replace(file); event.currentTarget.value = ""; }} />
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      aria-label={busy ? "照片上传中" : hasPhoto ? "替换首页地图照片" : "添加首页地图照片"}
    />
    {error && <small role="alert">{error}</small>}
  </div>;
}
