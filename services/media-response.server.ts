import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";
import { photoFileIssue } from "../components/media/upload-file.ts";
import { uploadMediaContent, createDirectUpload, validateMediaInput, completeDirectUpload } from "@/services/media-service.server";

export async function serveMediaUpload(request: Request, assetId: string, memberId: string) {
  try {
    await uploadMediaContent(memberId, assetId, request.headers.get("content-type"), request.body, request.headers.get("content-length"));
    return Response.json({ ok: true });
  } catch (error) {
    // Drain a bounded rejected body without retaining it. Cancelling an HTTP
    // upload mid-body can break the next request on a reused connection.
    if (request.body && !request.body.locked) {
      const length = Number(request.headers.get("content-length"));
      if (length > 0 && length <= 10 * 1024 * 1024) await request.body.pipeTo(new WritableStream()).catch(() => {});
      else await request.body.cancel().catch(() => {});
    }
    const code = error instanceof Error ? error.message : "";
    const status = code === "MEDIA_NOT_FOUND" ? 404 : code === "MEDIA_UPLOAD_ALREADY_COMPLETE" ? 409 : code === "MEDIA_UPLOAD_MISMATCH" ? 400 : code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? 503 : 500;
    return Response.json({ error: status === 400 ? "上传内容与授权信息不一致。" : status === 404 ? "没有找到这次上传。" : status === 409 ? "这张图片已经上传完成。" : status === 503 ? "图片存储暂时不可用。" : "图片上传失败，请重试。" }, { status });
  }
}

export async function authorizeMediaUpload(request: Request, memberId: string) {
  let requestedBytes: unknown;
  try {
    const raw = await request.json().catch(() => null);
    requestedBytes = raw?.byteSize;
    const body = validateMediaInput(raw);
    // Allow several photo batches without making invalid files consume slots.
    const limit = await consumeRateLimit("media-upload", memberId, 120, 10 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit, `本次上传较多，请 ${Math.ceil(limit.retryAfterSeconds / 60)} 分钟后重试。`);
    return Response.json(await createDirectUpload(memberId, body), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const invalid = code.startsWith("INVALID_MEDIA_");
    return Response.json({ code: invalid ? code : "MEDIA_UPLOAD_UNAVAILABLE", error: code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? "图片存储尚未完成配置，文字内容仍可正常保存。" : code === "INVALID_MEDIA_SIZE" ? photoFileIssue({ size: Number(requestedBytes) })?.message || "无法读取照片大小，请重新选择。" : code === "INVALID_MEDIA_TYPE" ? "不支持这种图片格式，请选择 JPG、PNG、WebP、HEIC 或 HEIF。" : invalid ? "照片信息无效，请重新选择。" : "无法准备图片上传，请稍后重试。" }, { status: code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? 503 : invalid ? 400 : 500 });
  }
}

export async function confirmMediaUpload(request: Request, assetId: string, memberId: string) {
  try {
    const limit = await consumeRateLimit("media-complete", memberId, 360, 10 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit, `图片确认较多，请 ${Math.ceil(limit.retryAfterSeconds / 60)} 分钟后重试。`);
    const body = await request.json().catch(() => ({})) as { width?: number | null; height?: number | null };
    return Response.json({ asset: await completeDirectUpload(memberId, assetId, body) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "MEDIA_NOT_FOUND" ? "没有找到这次上传。" : code === "MEDIA_UPLOAD_INCOMPLETE" ? "图片尚未完整上传，请重试。" : "图片校验失败，请重试。" }, { status: code === "MEDIA_NOT_FOUND" ? 404 : code === "MEDIA_UPLOAD_INCOMPLETE" ? 409 : 500 });
  }
}
