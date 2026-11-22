import type { MediaUploadAttempt } from "./client-upload";

export type AlbumUploadItem = { file: File; status: "waiting" | "uploading" | "attaching" | "done" | "error"; stage?: string; assetId?: string; attempt?: MediaUploadAttempt; capturedAt?: string | null; error?: string };

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
      if (item.capturedAt === undefined) { item.stage = "读取拍摄日期"; await publish(); item.capturedAt = await actions.capturedAt(item.file); }
      if (!item.assetId) {
        item.status = "uploading"; await publish();
        item.attempt ??= {};
        item.assetId = await actions.upload(item.file, item.attempt, publish);
      }
      item.status = "attaching"; item.stage = "加入相册"; if (item.attempt) item.attempt.stage = undefined; await publish();
      await actions.attach(item.assetId, item.capturedAt ?? null);
      item.status = "done";
    } catch (error) {
      item.status = "error";
      item.error = error instanceof Error ? error.message : "上传失败，请重试。";
      if (error instanceof Error && "retryAt" in error && typeof error.retryAt === "number") {
        // Pause the batch instead of sending every remaining file into the same 429.
        for (const pending of queue) {
          if (pending.status === "done") continue;
          pending.attempt ??= {};
          pending.attempt.retryAt = error.retryAt;
          pending.status = "error";
          pending.error = item.error;
        }
        await publish();
        break;
      }
    }
    await publish();
  }
  return queue;
}
