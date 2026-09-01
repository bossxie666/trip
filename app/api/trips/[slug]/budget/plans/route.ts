import { getCurrentMember } from "@/services/auth.server";
import { getPersonalBudgetWorkspace, upsertMemberBudgetPlan } from "@/services/budget-service.server";

function statusFor(code: string) {
  if (["TRIP_NOT_FOUND", "EXPENSE_NOT_FOUND"].includes(code)) return 404;
  if (["TRIP_MEMBER_REQUIRED"].includes(code)) return 403;
  return 400;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { return Response.json({ budget: await getPersonalBudgetWorkspace((await params).slug, actor.id) }); }
  catch (error) { const code = error instanceof Error ? error.message : ""; return Response.json({ error: "预算读取失败。" }, { status: statusFor(code) }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as { category?: string; plannedAmountMinor?: number; currency?: string };
    const plan = await upsertMemberBudgetPlan((await params).slug, actor.id, { category: body.category as never, plannedAmountMinor: Number(body.plannedAmountMinor), currency: body.currency });
    return Response.json({ plan });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return Response.json({ error: code === "TRIP_MEMBER_REQUIRED" ? "你不是这条行程的成员。" : "预算计划无效，请检查金额和分类。" }, { status: statusFor(code) });
  }
}
