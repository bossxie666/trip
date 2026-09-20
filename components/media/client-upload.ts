export type UploadPurpose = "home_featured" | "guestbook" | "recommendation_reference" | "trip_cover" | "album";

function normalizedType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "heic" ? "image/heic" : extension === "heif" ? "image/heif" : "";
}

export async function uploadMediaFile(file: File, purpose: UploadPurpose) {
  const contentType = normalizedType(file);
  const authorization = await fetch("/api/media/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose, filename: file.name, contentType, byteSize: file.size }) });
  const authorized = await authorization.json() as { assetId?: string; uploadUrl?: string; method?: string; headers?: Record<string, string>; error?: string };
  if (!authorization.ok || !authorized.assetId || !authorized.uploadUrl) throw new Error(authorized.error || "无法准备图片上传。");
  const uploaded = await fetch(authorized.uploadUrl, { method: authorized.method || "PUT", headers: authorized.headers, body: file });
  if (!uploaded.ok) throw new Error("图片上传失败，请重试。");
  const dimensions = await readImageDimensions(file);
  const completed = await fetch(`/api/media/uploads/${encodeURIComponent(authorized.assetId)}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(dimensions) });
  const result = await completed.json() as { asset?: { id: string }; error?: string };
  if (!completed.ok) throw new Error(result.error || "图片校验失败，请重试。");
  return authorized.assetId;
}

export async function readPhotoCapturedAt(file: File) {
  if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  try {
    const view = new DataView(await file.arrayBuffer());
    if (view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset), size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && offset + size + 2 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10, little = view.getUint16(tiff) === 0x4949;
        const u16 = (at: number) => view.getUint16(at, little), u32 = (at: number) => view.getUint32(at, little);
        const find = (directory: number, wanted: number) => { const count = u16(directory); for (let i = 0; i < count; i += 1) { const at = directory + 2 + i * 12; if (u16(at) === wanted) return u32(at + 8); } return 0; };
        const ifd0 = tiff + u32(tiff + 4), exifOffset = find(ifd0, 0x8769);
        if (!exifOffset) return null;
        const rawOffset = find(tiff + exifOffset, 0x9003) || find(tiff + exifOffset, 0x9004);
        if (!rawOffset) return null;
        let raw = ""; for (let i = 0; i < 19; i += 1) raw += String.fromCharCode(view.getUint8(tiff + rawOffset + i));
        const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
        return Number.isFinite(date.getTime()) ? date.toISOString() : null;
      }
      if (size < 2) break; offset += size + 2;
    }
  } catch { return null; }
  return null;
}

async function readImageDimensions(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return {};
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("图片无法读取。")); });
    image.src = url;
    await loaded;
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}
