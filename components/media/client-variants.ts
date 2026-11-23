import { mediaVariants } from "../../services/media-variant.ts";

const pending = new Set<string>();
const completed = new Set<string>();
let tail = Promise.resolve();

function enqueue(id: string, run: () => Promise<void>) {
  if (pending.has(id) || completed.has(id)) return;
  pending.add(id);
  tail = tail.then(async () => {
    // Yield before decoding or scaling so upload/navigation feedback can paint.
    await new Promise(resolve => setTimeout(resolve, 50));
    try { await run(); completed.add(id); }
    catch { /* Original uploads remain usable; thumbnails are best effort. */ }
    finally { pending.delete(id); if (completed.size > 200) completed.delete(completed.values().next().value!); }
  });
}

async function save(image: HTMLImageElement, id: string) {
  if (!image.naturalWidth || !image.naturalHeight) return;
  for (const [name, options] of Object.entries(mediaVariants)) {
    if (Math.max(image.naturalWidth, image.naturalHeight) <= options.width) continue;
    const canvas = document.createElement("canvas");
    const scale = Math.min(options.width / image.naturalWidth, options.width / image.naturalHeight);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", options.quality / 100));
    canvas.width = canvas.height = 0;
    if (!blob || blob.type !== "image/webp" || blob.size > 2 * 1024 * 1024) continue;
    const response = await fetch(`/api/media/${encodeURIComponent(id)}/variants/${name}`, { method: "PUT", headers: { "content-type": "image/webp" }, body: blob, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("MEDIA_VARIANT_FAILED");
  }
}

export function queueImageVariants(image: HTMLImageElement, assetId: string) {
  enqueue(assetId, () => save(image, assetId));
}

export function queueFileVariants(file: File, assetId: string) {
  enqueue(assetId, async () => {
    const url = URL.createObjectURL(file), image = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve(); image.onerror = () => reject(new Error("MEDIA_DECODE_FAILED"));
        timer = setTimeout(() => reject(new Error("MEDIA_DECODE_TIMEOUT")), 10_000);
        image.src = url;
      });
      await save(image, assetId);
    } finally { clearTimeout(timer); image.onload = image.onerror = null; image.src = ""; URL.revokeObjectURL(url); }
  });
}
