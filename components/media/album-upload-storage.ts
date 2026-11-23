import type { AlbumUploadItem } from "./album-upload-queue";
const database = "trip-photo-uploads", queues = "queues", files = "files";
const lifetime = 7 * 24 * 60 * 60 * 1000;
const persisted = new Set<string>();
type StoredItem = Omit<AlbumUploadItem, "file"> & { file?: Blob; fileKey?: string; fileName?: string; fileType?: string; fileModified?: number };
type StoredQueue = { updatedAt: number; items: StoredItem[] };
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 2);
    let settled = false;
    const fail = () => { if (settled) return; settled = true; clearTimeout(timer); reject(new Error("UPLOAD_STORAGE_UNAVAILABLE")); };
    const timer = setTimeout(fail, 8000);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(queues)) request.result.createObjectStore(queues); if (!request.result.objectStoreNames.contains(files)) request.result.createObjectStore(files); };
    request.onblocked = () => { /* Let another tab finish closing, bounded by the timer. */ }; request.onerror = fail;
    request.onsuccess = () => { if (settled) { request.result.close(); return; } settled = true; clearTimeout(timer); request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
function transaction(db: IDBDatabase, run: (tx: IDBTransaction) => void) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([queues, files], "readwrite");
    const timer = setTimeout(() => { try { tx.abort(); } catch { /* The transaction may already have ended. */ } reject(new Error("UPLOAD_STORAGE_TIMEOUT")); }, 10000);
    tx.oncomplete = () => { clearTimeout(timer); resolve(); };
    tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(tx.error || new Error("UPLOAD_STORAGE_UNAVAILABLE")); };
    try { run(tx); } catch (error) { clearTimeout(timer); tx.abort(); reject(error); }
  });
}
export async function saveUploadQueue(key: string, items: AlbumUploadItem[]) {
  const db = await open();
  const added: string[] = [], removed: string[] = [];
  try {
    await transaction(db, tx => {
      const records = tx.objectStore(queues), blobs = tx.objectStore(files);
      const pending = items.filter(item => item.status !== "done");
      const stored = pending.map(item => {
        item.clientId ||= crypto.randomUUID();
        const fileKey = `${key}:${item.clientId}`;
        if (!persisted.has(fileKey)) {
          const existing = blobs.getKey(fileKey);
          existing.onsuccess = () => {
            try { if (existing.result === undefined) blobs.put(item.file, fileKey); added.push(fileKey); }
            catch { tx.abort(); }
          };
        }
        const { file, ...metadata } = item;
        return { ...metadata, fileKey, fileName: file.name, fileType: file.type, fileModified: file.lastModified };
      });
      const retained = new Set(stored.map(item => item.fileKey));
      const previous = records.get(key);
      previous.onsuccess = () => {
        for (const item of (previous.result as StoredQueue | undefined)?.items || []) {
          if (item.fileKey && !retained.has(item.fileKey)) { blobs.delete(item.fileKey); removed.push(item.fileKey); }
        }
      };
      if (stored.length) records.put({ updatedAt: Date.now(), items: stored }, key);
      else records.delete(key);
    });
    for (const id of added) persisted.add(id);
    for (const id of removed) persisted.delete(id);
  } finally { db.close(); }
}
export async function loadUploadQueue(key: string): Promise<AlbumUploadItem[]> {
  const db = await open();
  const result: AlbumUploadItem[] = [];
  try {
    await transaction(db, tx => {
      const records = tx.objectStore(queues), blobs = tx.objectStore(files), cursor = records.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const record = row.value as StoredQueue;
        if (Date.now() - record.updatedAt > lifetime) {
          for (const item of record.items) if (item.fileKey) { blobs.delete(item.fileKey); persisted.delete(item.fileKey); }
          row.delete();
        } else if (row.key === key) {
          for (const item of record.items) {
            const restored = { ...item, clientId: item.clientId || crypto.randomUUID(), restored: true, status: "error" as const,
              file: item.file instanceof Blob ? item.file instanceof File ? item.file : new File([item.file], item.fileName || "照片", { type: item.file.type }) : new File([], item.fileName || "照片"),
              error: item.error || ((item.attempt?.stage || item.stage) ? `上次在“${item.attempt?.stage || item.stage}”时中断，请重试。` : "上传未完成，请重试。") };
            delete restored.fileKey; delete restored.fileName; delete restored.fileType; delete restored.fileModified;
            result.push(restored);
            if (item.fileKey) {
              const read = blobs.get(item.fileKey);
              read.onsuccess = () => { if (read.result instanceof Blob) { restored.file = read.result instanceof File ? read.result : new File([read.result], item.fileName || "照片", { type: item.fileType, lastModified: item.fileModified }); persisted.add(item.fileKey!); } };
            }
          }
        }
        row.continue();
      };
    });
    return result;
  } finally { db.close(); }
}
