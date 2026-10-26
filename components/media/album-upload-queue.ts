export type AlbumUploadItem = { file: File; status: "waiting" | "uploading" | "attaching" | "done" | "error"; assetId?: string; capturedAt?: string | null; error?: string };

/** Retain completed uploads when attachment fails; retry never uploads them twice. */
export async function runAlbumUploadQueue(items: AlbumUploadItem[], actions: {
  upload: (file: File) => Promise<string>;
  capturedAt: (file: File) => Promise<string | null>;
  attach: (assetId: string, capturedAt: string | null) => Promise<unknown>;
  changed: (items: AlbumUploadItem[]) => void;
}) {
  const queue = items.map((item) => ({ ...item }));
  const publish = () => actions.changed(queue.map((item) => ({ ...item })));
  for (const item of queue) {
    if (item.status === "done") continue;
    try {
      item.error = undefined;
      if (item.capturedAt === undefined) item.capturedAt = await actions.capturedAt(item.file);
      if (!item.assetId) {
        item.status = "uploading"; publish();
        item.assetId = await actions.upload(item.file);
      }
      item.status = "attaching"; publish();
      await actions.attach(item.assetId, item.capturedAt ?? null);
      item.status = "done";
    } catch (error) {
      item.status = "error";
      item.error = error instanceof Error ? error.message : "上传失败，请重试。";
    }
    publish();
  }
  return queue;
}
