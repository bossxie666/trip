import type { AlbumUploadItem } from "./album-upload-queue";
const prefix = "trip-upload-journal:";
const lifetime = 7 * 86400_000;
type Entry = Omit<AlbumUploadItem, "file" | "attempt"> & { name: string; size: number; modified: number; type: string };

/** Small independent record: no photo bytes or signed upload URLs. */
export function saveUploadJournal(key: string, items: AlbumUploadItem[]) {
  const pending: Entry[] = items.filter(item => item.status !== "done").map(item => {
    const copy = { ...item }; delete copy.attempt;
    const { file, ...metadata } = copy;
    return { ...metadata, name: file.name, size: file.size || item.originalBytes || 0, modified: file.lastModified, type: file.type };
  });
  localStorage.setItem(prefix + key, JSON.stringify({ updatedAt: Date.now(), items: pending }));
}

export function restoreUploadJournal(key: string, stored: AlbumUploadItem[]): AlbumUploadItem[] | null {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return null;
    const value = JSON.parse(raw) as { updatedAt: number; items: Entry[] };
    if (!Number.isFinite(value.updatedAt) || Date.now() - value.updatedAt > lifetime || !Array.isArray(value.items)) return null;
    return value.items.map(entry => {
      const { name, size, modified, type, ...metadata } = entry;
      const existing = stored.find(item => item.clientId === entry.clientId);
      const file = existing?.file || new File([], name, { type, lastModified: modified });
      const needsReselect = !file.size && !metadata.assetId && !existing?.attempt?.uploaded;
      return { ...existing, ...metadata, file, restored: true, status: "error", originalBytes: metadata.originalBytes || size, needsReselect,
        error: needsReselect ? "上传记录已恢复，照片文件未保留，请重新选择这张照片。" : metadata.error || "上次上传未完成，请重试。" };
    });
  } catch { return null; }
}
