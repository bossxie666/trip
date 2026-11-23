import { mediaVariants, mediaVariantKey } from "./media-variant.ts";
import type { MediaReadEnv } from "./media-read.server";

export async function saveBrowserMediaVariant(request: Request, assetId: string, variant: string, memberId: string, env: MediaReadEnv) {
  const length = Number(request.headers.get("content-length"));
  const reject = async (status: number, error: string) => {
    if (request.body && !request.body.locked) {
      if (length > 0 && length <= 2 * 1024 * 1024) await request.body.pipeTo(new WritableStream()).catch(() => {});
      else await request.body.cancel().catch(() => {});
    }
    return Response.json({ error }, { status });
  };
  if (!Object.hasOwn(mediaVariants, variant) || request.headers.get("content-type") !== "image/webp" || !request.body || !Number.isSafeInteger(length) || length <= 0 || length > 2 * 1024 * 1024) {
    return reject(400, "图片尺寸版本无效。");
  }
  const asset = await env.DB.prepare("SELECT object_key AS objectKey FROM media_assets WHERE id=? AND uploader_member_id=? AND status='ready' LIMIT 1").bind(assetId, memberId).first<{ objectKey: string }>();
  if (!asset) return reject(403, "没有修改这张照片的权限。");
  if (!env.MEDIA) return reject(503, "图片存储暂时不可用。");
  const key = mediaVariantKey(asset.objectKey, variant as keyof typeof mediaVariants);
  // Existing versions are immutable: a later member action cannot overwrite
  // another rendering. Resource removal cleans these keys with the original.
  if (await env.MEDIA.head(key)) {
    await request.body.pipeTo(new WritableStream()).catch(() => {});
    return Response.json({ ok: true });
  }
  const bounded = new FixedLengthStream(length);
  try {
    await Promise.all([request.body.pipeTo(bounded.writable), env.MEDIA.put(key, bounded.readable, { httpMetadata: { contentType: "image/webp" } })]);
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "图片尺寸版本未保存。" }, { status: 400 }); }
}
