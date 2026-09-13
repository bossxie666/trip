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
