import { getRuntimeEnv } from "@/db";
import { getAuthorizedReadyMediaAsset, uploadMediaContent } from "@/services/media-service.server";

const variants = { thumb: { width: 480, quality: 76 }, card: { width: 960, quality: 82 }, display: { width: 1600, quality: 84 } } as const;

export async function serveMedia(request: Request, assetId: string, memberId: string) {
  const asset = await getAuthorizedReadyMediaAsset(assetId, memberId);
  if (!asset) return Response.json({ error: "图片不存在。" }, { status: 404, headers: {"cache-control":"private, no-store"} });
  const env = getRuntimeEnv();
  if (!env.MEDIA) return Response.json({ error: "图片存储暂时不可用。" }, { status: 503, headers: {"cache-control":"private, no-store"} });
  const object = await env.MEDIA.get(asset.objectKey);
  if (!object?.body) return Response.json({ error: "图片不存在。" }, { status: 404, headers: {"cache-control":"private, no-store"} });
  const requested = new URL(request.url).searchParams.get("variant") || "display";
  const variant = variants[requested as keyof typeof variants] || variants.display;
  try {
    const transformed = await env.IMAGES.input(object.body).transform({ width: variant.width, fit: "scale-down" }).output({ format: "image/webp", quality: variant.quality });
    const response = transformed.response();
    const headers = new Headers(response.headers);
    headers.set("cache-control", (asset.purpose==="album"||asset.purpose==="guestbook")?"private, no-store":"private, max-age=86400");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", (asset.purpose==="album"||asset.purpose==="guestbook")?"private, no-store":"private, max-age=3600");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  }
}

export async function serveMediaUpload(request: Request, assetId: string, memberId: string) {
  try {
    await uploadMediaContent(memberId, assetId, request.headers.get("content-type"), request.body, request.headers.get("content-length"));
    return Response.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "MEDIA_NOT_FOUND" ? 404 : code === "MEDIA_UPLOAD_ALREADY_COMPLETE" ? 409 : code === "MEDIA_UPLOAD_MISMATCH" ? 400 : code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? 503 : 500;
    return Response.json({ error: status === 400 ? "上传内容与授权信息不一致。" : status === 404 ? "没有找到这次上传。" : status === 409 ? "这张图片已经上传完成。" : status === 503 ? "图片存储暂时不可用。" : "图片上传失败，请重试。" }, { status });
  }
}
