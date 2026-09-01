import { getCurrentMember } from "@/services/auth.server";
import { deleteExpense, updateExpense, type UpdateExpenseInput } from "@/services/budget-service.server";

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const status = code === "EXPENSE_NOT_FOUND" || code === "TRIP_NOT_FOUND" ? 404 : code === "EXPENSE_OWNER_REQUIRED" || code === "TRIP_MEMBER_REQUIRED" ? 403 : 400;
  return Response.json({ error: code === "EXPENSE_OWNER_REQUIRED" ? "个人费用只能由记录人修改。" : code === "ALLOCATION_TOTAL_MISMATCH" ? "分摊金额合计必须等于费用金额。" : "费用更新失败，请检查后重试。" }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { const body = await request.json() as UpdateExpenseInput; const expense = await updateExpense((await params).slug, actor.id, (await params).id, body); return Response.json({ expense }); }
  catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { await deleteExpense((await params).slug, actor.id, (await params).id); return Response.json({ deleted: true }); }
  catch (error) { return errorResponse(error); }
}
