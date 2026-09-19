import { getCurrentMember } from "@/services/auth.server";
import { uploadMediaContent } from "@/services/media-service.server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const bytes = await request.arrayBuffer();
    await uploadMediaContent(actor.id, (await params).id, request.headers.get("content-type"), bytes);
    return Response.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "MEDIA_NOT_FOUND" ? 404 : code === "MEDIA_UPLOAD_ALREADY_COMPLETE" ? 409 : code === "MEDIA_UPLOAD_MISMATCH" ? 400 : code === "MEDIA_UPLOAD_NOT_CONFIGURED" ? 503 : 500;
    return Response.json({ error: status === 400 ? "上传内容与授权信息不一致。" : status === 404 ? "没有找到这次上传。" : status === 409 ? "这张图片已经上传完成。" : status === 503 ? "图片存储暂时不可用。" : "图片上传失败，请重试。" }, { status });
  }
}
