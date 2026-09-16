import { getCurrentMember } from "@/services/auth.server";
import { createDirectUpload } from "@/services/media-service.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";

export async function POST(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const limit = await consumeRateLimit("media-upload", actor.id, 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit, "图片上传过于频繁，请稍后再试。");
    const body = await request.json() as { purpose?: string; filename?: string; contentType?: string; byteSize?: number };
    return Response.json(await createDirectUpload(actor.id, body), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const invalid = code.startsWith("INVALID_MEDIA_");
    return Response.json({ error: code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? "图片存储尚未完成配置，文字内容仍可正常保存。" : invalid ? "请选择 10MB 以内的 JPG、PNG、WebP、HEIC 或 HEIF 图片。" : "无法准备图片上传，请稍后重试。" }, { status: code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? 503 : invalid ? 400 : 500 });
  }
}
