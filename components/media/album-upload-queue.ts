import type { MediaUploadAttempt } from "./client-upload";

export type AlbumUploadItem = { file: File; status: "waiting" | "uploading" | "attaching" | "done" | "error"; assetId?: string; attempt?: MediaUploadAttempt; capturedAt?: string | null; error?: string };

/** Retain completed uploads when attachment fails; retry never uploads them twice. */
export async function runAlbumUploadQueue(items: AlbumUploadItem[], actions: {
  upload: (file: File, attempt: MediaUploadAttempt, checkpoint: () => Promise<void>) => Promise<string>;
  capturedAt: (file: File) => Promise<string | null>;
  attach: (assetId: string, capturedAt: string | null) => Promise<unknown>;
  changed: (items: AlbumUploadItem[]) => void | Promise<void>;
}) {
  const queue = items.map((item) => ({ ...item }));
  const publish = async () => { await actions.changed(queue.map((item) => ({ ...item }))); };
  await publish();
  for (const item of queue) {
    if (item.status === "done") continue;
    try {
      item.error = undefined;
      if (item.capturedAt === undefined) item.capturedAt = await actions.capturedAt(item.file);
      if (!item.assetId) {
        item.status = "uploading"; await publish();
        item.attempt ??= {};
        item.assetId = await actions.upload(item.file, item.attempt, publish);
      }
      item.status = "attaching"; await publish();
      await actions.attach(item.assetId, item.capturedAt ?? null);
      item.status = "done";
    } catch (error) {
      item.status = "error";
      item.error = error instanceof Error ? error.message : "上传失败，请重试。";
    }
    await publish();
  }
  return queue;
}
