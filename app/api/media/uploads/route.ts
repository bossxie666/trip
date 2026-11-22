import { getCurrentMember } from "@/services/auth.server";
import { createDirectUpload, validateMediaInput } from "@/services/media-service.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";

export async function POST(request: Request) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = validateMediaInput(await request.json().catch(() => null));
    // Allow several photo batches without making invalid files consume slots.
    const limit = await consumeRateLimit("media-upload", actor.id, 120, 10 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit, `本次上传较多，请 ${Math.ceil(limit.retryAfterSeconds / 60)} 分钟后重试。`);
    return Response.json(await createDirectUpload(actor.id, body), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const invalid = code.startsWith("INVALID_MEDIA_");
    return Response.json({ error: code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? "图片存储尚未完成配置，文字内容仍可正常保存。" : code === "INVALID_MEDIA_SIZE" ? "照片大小必须大于 0 且不超过 10MB。" : code === "INVALID_MEDIA_TYPE" ? "不支持这种图片格式，请选择 JPG、PNG、WebP、HEIC 或 HEIF。" : invalid ? "照片信息无效，请重新选择。" : "无法准备图片上传，请稍后重试。" }, { status: code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? 503 : invalid ? 400 : 500 });
  }
}
