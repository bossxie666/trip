import type { MediaUploadAttempt } from "./client-upload";
import { photoFileIssue } from "./upload-file.ts";

export type AlbumUploadItem = { file: File; clientId?: string; restored?: boolean; errorCode?: string; status: "waiting" | "uploading" | "attaching" | "done" | "error"; stage?: string; assetId?: string; attempt?: MediaUploadAttempt; capturedAt?: string | null; error?: string };

/** Retain completed uploads when attachment fails; retry never uploads them twice. */
export async function runAlbumUploadQueue(items: AlbumUploadItem[], actions: {
  upload: (file: File, attempt: MediaUploadAttempt, checkpoint: () => Promise<void>) => Promise<string>;
  capturedAt: (file: File) => Promise<string | null>;
  attach: (assetId: string, capturedAt: string | null) => Promise<unknown>;
  changed: (items: AlbumUploadItem[]) => void | Promise<void>;
  signal?: AbortSignal;
}) {
  const queue = items.map((item) => ({ ...item, clientId: item.clientId || crypto.randomUUID() }));
  const publish = async () => { await actions.changed(queue.map((item) => ({ ...item }))); };
  await publish();
  for (const item of queue) {
    if (item.status === "done") continue;
    try {
      actions.signal?.throwIfAborted();
      item.error = undefined;
      item.errorCode = undefined;
      item.restored = false;
      const issue = !item.assetId && !item.attempt?.uploaded && photoFileIssue(item.file);
      if (issue) throw Object.assign(new Error(issue.message), { code: issue.code });
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
      item.errorCode = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;
      item.error = actions.signal?.aborted ? "上传已暂停，可继续上传。" : error instanceof Error && error.name === "TimeoutError" ? "这次上传超时，照片已保留，可重试。" : error instanceof Error && error.name === "NotReadableError" ? "手机暂时无法读取这张照片，请重新选择文件。" : error instanceof Error ? error.message : "上传失败，请重试。";
      if (actions.signal?.aborted) {
        for (const pending of queue) {
          if (pending.status === "done" || pending.status === "error") continue;
          pending.status = "error";
          pending.error = "上传已暂停，可继续上传。";
        }
        await publish();
        break;
      }
      if (error instanceof Error && ["TimeoutError", "TypeError"].includes(error.name)) {
        item.error = error.name === "TimeoutError" ? "这次上传超时，本批已暂停，可重试。" : "网络连接中断，本批已暂停，可重试。";
        for (const pending of queue) {
          if (pending.status === "done" || pending.status === "error") continue;
          pending.status = "error";
          pending.error = "本批上传已暂停，可一起重试。";
        }
        await publish();
        break;
      }
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
