import { getRuntimeEnv } from "@/db";
import { getCurrentMember } from "@/services/auth.server";
import { getReadyMediaAsset } from "@/services/media-service.server";

const variants = { thumb: { width: 480, quality: 76 }, card: { width: 960, quality: 82 }, display: { width: 1600, quality: 84 } } as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentMember()) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const asset = await getReadyMediaAsset((await params).id);
  if (!asset) return Response.json({ error: "图片不存在。" }, { status: 404 });
  const env = getRuntimeEnv();
  if (!env.MEDIA) return Response.json({ error: "图片存储暂时不可用。" }, { status: 503 });
  const object = await env.MEDIA.get(asset.objectKey);
  if (!object?.body) return Response.json({ error: "图片不存在。" }, { status: 404 });
  const requested = new URL(request.url).searchParams.get("variant") || "display";
  const variant = variants[requested as keyof typeof variants] || variants.display;
  try {
    const transformed = await env.IMAGES.input(object.body).transform({ width: variant.width, fit: "scale-down" }).output({ format: "image/webp", quality: variant.quality });
    const response = transformed.response();
    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, max-age=86400");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, max-age=3600");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  }
}
