import { getCurrentMember } from "@/services/auth.server";
import { createExpense, getPersonalBudgetWorkspace, type CreateExpenseInput } from "@/services/budget-service.server";

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const status = code === "TRIP_NOT_FOUND" || code === "EXPENSE_NOT_FOUND" ? 404 : code === "TRIP_MEMBER_REQUIRED" ? 403 : 400;
  const messages: Record<string, string> = {
    EXPENSE_TITLE_REQUIRED: "请填写费用名称。", EXPENSE_AMOUNT_REQUIRED: "金额必须大于 0。", EXPENSE_PARTICIPANTS_REQUIRED: "共享费用至少选择一位承担人。", ALLOCATION_TOTAL_MISMATCH: "分摊金额合计必须等于费用金额。", DAY_NOT_IN_TRIP: "所选日期不属于当前行程。",
  };
  return Response.json({ error: messages[code] || "费用记录无效，请检查后重试。" }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try { return Response.json({ budget: await getPersonalBudgetWorkspace((await params).slug, actor.id) }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  try {
    const body = await request.json() as Partial<CreateExpenseInput>;
    if (typeof body.scope !== "string") throw new Error("INVALID_EXPENSE_SCOPE");
    const expense = await createExpense((await params).slug, actor.id, {
      title: String(body.title || ""), category: body.category as CreateExpenseInput["category"], amountMinor: Number(body.amountMinor), currency: body.currency, scope: body.scope as CreateExpenseInput["scope"], dayId: body.dayId ?? null, paidByMemberId: body.paidByMemberId ?? null, allocations: Array.isArray(body.allocations) ? body.allocations as CreateExpenseInput["allocations"] : undefined, participantMemberIds: Array.isArray(body.participantMemberIds) ? body.participantMemberIds.map(String) : undefined, notes: body.notes ?? null, occurredAt: body.occurredAt ?? null, occurredDate: body.occurredDate ?? null,
    });
    return Response.json({ expense }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
