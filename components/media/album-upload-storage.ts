import type { AlbumUploadItem } from "./album-upload-queue";
const database = "trip-photo-uploads", store = "queues";
const lifetime = 7 * 24 * 60 * 60 * 1000;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveUploadQueue(key: string, items: AlbumUploadItem[]) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite"), records = tx.objectStore(store);
      const pending = items.filter(item => item.status !== "done");
      if (pending.length) records.put({ updatedAt: Date.now(), items: pending }, key);
      else records.delete(key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function loadUploadQueue(key: string): Promise<AlbumUploadItem[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite"), records = tx.objectStore(store);
      let result: AlbumUploadItem[] = [];
      const cursor = records.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const record = row.value as { updatedAt: number; items: AlbumUploadItem[] };
        if (Date.now() - record.updatedAt > lifetime) row.delete();
        else if (row.key === key) result = record.items.map(item => ({ ...item, status: "error", error: item.error || ((item.attempt?.stage || item.stage) ? `上次在“${item.attempt?.stage || item.stage}”时中断，请重试。` : "上传未完成，请重试。") }));
        row.continue();
      };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
