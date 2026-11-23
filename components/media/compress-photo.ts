import { maxPhotoBytes } from "./upload-file.ts";

/** Produce an upload copy without changing the selected original. */
export async function compressOversizedPhoto(file: File, signal?: AbortSignal): Promise<File> {
  if (file.size <= maxPhotoBytes) return file;
  signal?.throwIfAborted();
  const url = URL.createObjectURL(file), image = new Image(), canvas = document.createElement("canvas");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error("手机无法解码这张照片，请从相册导出 JPG 后重新选择。"));
      timer = setTimeout(() => reject(new Error("照片压缩超时，请重新选择照片再试。")), 20000);
      image.src = url;
    });
    for (const edge of [4096, 3072, 2048]) {
      signal?.throwIfAborted();
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("浏览器暂时无法压缩照片，请换浏览器重试。");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("照片压缩超时，请重试。")), 20000);
        canvas.toBlob(value => { clearTimeout(timeout); resolve(value); }, "image/jpeg", .9);
      });
      signal?.throwIfAborted();
      if (blob && blob.size > 0 && blob.size <= maxPhotoBytes) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: blob.type, lastModified: file.lastModified });
    }
    throw new Error("照片压缩后仍过大，请选择较小版本。");
  } finally { clearTimeout(timer); image.onload = image.onerror = null; image.src = ""; URL.revokeObjectURL(url); canvas.width = canvas.height = 0; }
}
