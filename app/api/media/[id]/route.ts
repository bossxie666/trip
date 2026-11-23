import { getCurrentMember } from "@/services/auth.server";
import { serveMedia } from "@/services/media-read.server";
import { getRuntimeEnv } from "@/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401, headers: { "cache-control": "private, no-store" } });
  return serveMedia(request, (await params).id, actor.id, getRuntimeEnv());
}
