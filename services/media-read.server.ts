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
  const cacheKey = mediaVariantKey(asset.objectKey, name);
  const cached = await env.MEDIA.get(cacheKey);
  if (cached?.body) return new Response(cached.body, { headers: { "content-type": "image/webp", "cache-control": (asset.purpose === "album" || asset.purpose === "guestbook") ? "private, no-store" : "private, max-age=86400", "content-disposition": "inline", "x-content-type-options": "nosniff" } });
  const object = await env.MEDIA.get(asset.objectKey);
  if (!object?.body) return Response.json({ error: "图片不存在。" }, { status: 404, headers: {"cache-control":"private, no-store"} });
  // Free Workers cannot reliably perform image encoding within 10ms. Missing
  // variants use the original stream; the uploader's browser creates variants.
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", (asset.purpose === "album" || asset.purpose === "guestbook") ? "private, no-store" : "private, max-age=3600");
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
