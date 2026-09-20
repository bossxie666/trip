import { getCurrentMember } from "@/services/auth.server";
import { updateMemberAvatar } from "@/services/member-repository.server";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  return Response.json({ member: { id: member.id, displayName: member.displayName, avatar: member.avatar } });
}

export async function PATCH(request: Request) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { assetId?: string };
  if (!body.assetId) return Response.json({ error: "请选择头像。" }, { status: 400 });
  try { return Response.json({ member: await updateMemberAvatar(member.id, body.assetId) }); }
  catch { return Response.json({ error: "头像更新失败。" }, { status: 400 }); }
}
