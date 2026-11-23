import { findAuthorizedMediaAsset } from "./media-access.server.ts";
import { mediaVariants, mediaVariantKey } from "./media-variant.ts";
export type MediaReadEnv = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  IMAGES: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
};

export async function serveMedia(request: Request, assetId: string, memberId: string, env: MediaReadEnv) {
  const asset = await findAuthorizedMediaAsset(env.DB, assetId, memberId);
  if (!asset) return Response.json({ error: "图片不存在。" }, { status: 404, headers: {"cache-control":"private, no-store"} });
  if (!env.MEDIA) return Response.json({ error: "图片存储暂时不可用。" }, { status: 503, headers: {"cache-control":"private, no-store"} });
  const requested = new URL(request.url).searchParams.get("variant") || "display";
  const name = Object.hasOwn(mediaVariants, requested) ? requested as keyof typeof mediaVariants : "display";
  const variant = mediaVariants[name];
  const cacheKey = mediaVariantKey(asset.objectKey, name);
  const cached = await env.MEDIA.get(cacheKey);
  if (cached?.body) return new Response(cached.body, { headers: { "content-type": "image/webp", "cache-control": (asset.purpose === "album" || asset.purpose === "guestbook") ? "private, no-store" : "private, max-age=86400", "content-disposition": "inline", "x-content-type-options": "nosniff" } });
  const object = await env.MEDIA.get(asset.objectKey);
  if (!object?.body) return Response.json({ error: "图片不存在。" }, { status: 404, headers: {"cache-control":"private, no-store"} });
  try {
    const transformed = await env.IMAGES.input(object.body).transform({ width: variant.width, fit: "scale-down" }).output({ format: "image/webp", quality: variant.quality });
    const response = transformed.response();
    if (!response.ok) throw new Error("MEDIA_TRANSFORM_FAILED");
    // The source asset is immutable. Cache only its bytes in private R2;
    // membership above is still checked on every request before this lookup.
    try { await env.MEDIA.put(cacheKey, response.clone().body, { httpMetadata: { contentType: "image/webp" } }); }
    catch { /* Storage-cache failure must not prevent the image response. */ }
    const headers = new Headers(response.headers);
    headers.set("cache-control", (asset.purpose==="album"||asset.purpose==="guestbook")?"private, no-store":"private, max-age=86400");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    // Images may already have consumed the original stream before failing.
    const fallback = await env.MEDIA.get(asset.objectKey);
    if (!fallback?.body) return Response.json({ error: "图片暂时不可用，请重试。" }, { status: 503, headers: { "cache-control": "private, no-store" } });
    const headers = new Headers();
    fallback.writeHttpMetadata(headers);
    headers.set("cache-control", (asset.purpose==="album"||asset.purpose==="guestbook")?"private, no-store":"private, max-age=3600");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(fallback.body, { headers });
  }
}

