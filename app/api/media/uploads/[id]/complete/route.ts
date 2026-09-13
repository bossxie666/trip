import { getCurrentMember } from "@/services/auth.server";
import { completeDirectUpload } from "@/services/media-service.server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { width?: number | null; height?: number | null };
    return Response.json({ asset: await completeDirectUpload(actor.id, (await params).id, body) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "MEDIA_NOT_FOUND" ? "没有找到这次上传。" : code === "MEDIA_UPLOAD_INCOMPLETE" ? "图片尚未完整上传，请重试。" : "图片校验失败，请重试。" }, { status: code === "MEDIA_NOT_FOUND" ? 404 : code === "MEDIA_UPLOAD_INCOMPLETE" ? 409 : 500 });
  }
}
