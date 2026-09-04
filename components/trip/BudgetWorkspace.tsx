"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { WorkspaceNavLink as Link } from "./WorkspaceNavLink";
import type { PersonalBudgetWorkspace } from "@/services/budget-service.server";
import type { BudgetCategory } from "@/models/planning";
import { EstimatedTransport, type EstimateSnapshot } from "./EstimatedTransport";
import { BookingPlaceControl } from "./BookingPlaceControl";
import { TransportIcon, iconForBookingType } from "./TransportIcon";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

type Member = { id: string; displayName: string };
type Day = { id: string; label: string };
type RouteStop = { id: string; title: string; place: { id: string; cityId: string }; memberStates?: Record<string, "present" | "absent" | "partial" | "unknown"> };
type RouteSegment = { id: string; from: RouteStop; to: RouteStop; crossCity: boolean };
type RoutePreference = { dayId: string; fromId: string; toId: string; memberId: string | null; preferredMode: import("@/services/amap/amap-types").AMapRouteMode };

const categories: { key: BudgetCategory; label: string }[] = [
  { key: "food", label: "吃饭" },
  { key: "local_transport", label: "市内交通" },
  { key: "entertainment", label: "娱乐" },
  { key: "shopping", label: "购物" },
  { key: "other", label: "其他" },
];
const categoryLabel = Object.fromEntries(categories.map((category) => [category.key, category.label])) as Record<BudgetCategory, string>;
const money = (minor: number | null | undefined) => minor == null ? "—" : `¥${(minor / 100).toFixed(2).replace(/\.00$/, "")}`;
const yuan = (minor: number | null | undefined) => minor == null ? "" : (minor / 100).toFixed(2);
const toMinor = (value: string) => { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 100) : NaN; };

function ErrorMessage({ value }: { value: string }) { return value ? <p className="budget-error" role="alert">{value}</p> : null; }

function BookingEditControl({ slug, booking, members }: { slug: string; booking: PersonalBudgetWorkspace["bookings"][number]; members: Member[] }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [open, setOpen] = useState(false), [title, setTitle] = useState(booking.title), [status, setStatus] = useState(booking.status), [amount, setAmount] = useState(yuan(booking.totalAmountMinor)), [participantIds, setParticipantIds] = useState(booking.participants.map((member) => member.memberId)), [allocationMembers, setAllocationMembers] = useState<Record<string, string[]>>(() => Object.fromEntries(booking.costLines.map((line) => [line.id, line.allocations.map((allocation) => allocation.memberId)]))), [allocationAmounts, setAllocationAmounts] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(booking.costLines.map((line) => [line.id, Object.fromEntries(line.allocations.map((allocation) => [allocation.memberId, yuan(allocation.amountMinor)]))]))), [saving, setSaving] = useState(false), [error, setError] = useState("");
  function toggleParticipant(id: string) { setParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleAllocationMember(lineId: string, id: string) { setAllocationMembers((current) => ({ ...current, [lineId]: (current[lineId] || []).includes(id) ? (current[lineId] || []).filter((item) => item !== id) : [...(current[lineId] || []), id] })); }
  async function save() {
    setSaving(true); setError("");
    try {
      const costLineAllocations = booking.costLines.map((line) => line.allocationMode === "equal" ? { costLineId: line.id, memberIds: allocationMembers[line.id] || [] } : { costLineId: line.id, allocations: (allocationMembers[line.id] || []).map((memberId) => ({ memberId, amountMinor: toMinor(allocationAmounts[line.id]?.[memberId] || "0") })) });
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/budget/bookings/${encodeURIComponent(booking.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, status, totalAmountMinor: amount ? toMinor(amount) : null, participantMemberIds: participantIds, costLineAllocations }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "订单更新失败");
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "订单更新失败"); setSaving(false); }
  }
  return <details className="budget-booking-edit" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}><summary>编辑订单信息</summary><div><label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="tentative">待确认</option><option value="confirmed">已确认</option><option value="cancelled">已取消</option></select></label><label>订单总额（元）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><fieldset><legend>订单使用成员</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} /> {member.displayName}</label>)}</div></fieldset>{booking.costLines.map((line) => <fieldset key={line.id}><legend>{line.title} · {line.allocationMode === "equal" ? "平均分摊" : "自定义分摊"}（{money(line.amountMinor)}）</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={(allocationMembers[line.id] || []).includes(member.id)} onChange={() => toggleAllocationMember(line.id, member.id)} /> {member.displayName}</label>)}</div>{line.allocationMode === "custom" && <div className="budget-custom-split">{(allocationMembers[line.id] || []).map((memberId) => <label key={memberId}>{members.find((member) => member.id === memberId)?.displayName}<input inputMode="decimal" value={allocationAmounts[line.id]?.[memberId] || ""} onChange={(event) => setAllocationAmounts((current) => ({ ...current, [line.id]: { ...(current[line.id] || {}), [memberId]: event.target.value } }))} placeholder="0.00" /></label>)}</div>}</fieldset>)}<button type="button" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存订单"}</button><ErrorMessage value={error} /></div></details>;
}

function ExpenseForm({ slug, members, days, currentMemberId, onClose }: { slug: string; members: Member[]; days: Day[]; currentMemberId: string; onClose: () => void }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [title, setTitle] = useState(""), [amount, setAmount] = useState(""), [category, setCategory] = useState<BudgetCategory>("food"), [scope, setScope] = useState<"personal" | "shared">("personal"), [dayId, setDayId] = useState(days[0]?.id || ""), [occurredDate, setOccurredDate] = useState(""), [paidByMemberId, setPaidByMemberId] = useState(currentMemberId), [participantIds, setParticipantIds] = useState<string[]>(members.map((member) => member.id)), [allocationMode, setAllocationMode] = useState<"equal" | "custom">("equal"), [customAmounts, setCustomAmounts] = useState<Record<string, string>>({}), [notes, setNotes] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  function toggleParticipant(id: string) { setParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const amountMinor = toMinor(amount);
      const allocations = scope === "shared" && allocationMode === "custom" ? participantIds.map((memberId) => ({ memberId, amountMinor: toMinor(customAmounts[memberId] || "0") })) : undefined;
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("金额必须大于 0。");
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/budget/expenses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, amountMinor, category, scope, dayId: dayId || null, occurredDate: occurredDate || null, paidByMemberId: scope === "shared" ? paidByMemberId : currentMemberId, participantMemberIds: scope === "shared" && allocationMode === "equal" ? participantIds : undefined, allocations, notes: notes || null }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败");
      onClose();
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); setSaving(false); }
  }
  return <div className="budget-expense-modal" role="dialog" aria-modal="true" aria-label="记一笔"><div className="budget-expense-sheet"><header><div><span>NEW EXPENSE</span><h3>记一笔</h3></div><button type="button" className="budget-close" onClick={onClose} aria-label="关闭">×</button></header><form onSubmit={submit}><label>费用名称<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：晚餐" /></label><div className="budget-form-grid"><label>金额（元）<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as BudgetCategory)}>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div><label>归属日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}><option value="">不关联日期</option>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>实际日期（可选）<input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} /></label><fieldset><legend>费用类型</legend><label><input type="radio" checked={scope === "personal"} onChange={() => setScope("personal")} /> 我的个人费用</label><label><input type="radio" checked={scope === "shared"} onChange={() => setScope("shared")} /> 共享费用</label></fieldset>{scope === "shared" && <><label>实际付款人<select value={paidByMemberId} onChange={(event) => setPaidByMemberId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><fieldset><legend>参与分摊</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} /> {member.displayName}</label>)}</div><div className="budget-split-mode"><label><input type="radio" checked={allocationMode === "equal"} onChange={() => setAllocationMode("equal")} /> 平均分摊</label><label><input type="radio" checked={allocationMode === "custom"} onChange={() => setAllocationMode("custom")} /> 自定义金额</label></div>{allocationMode === "custom" && <div className="budget-custom-split">{participantIds.map((memberId) => <label key={memberId}>{members.find((member) => member.id === memberId)?.displayName}<input inputMode="decimal" value={customAmounts[memberId] || ""} onChange={(event) => setCustomAmounts((current) => ({ ...current, [memberId]: event.target.value }))} placeholder="0.00" /></label>)}</div>}</fieldset></>}<label>备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><ErrorMessage value={error} /><button className="budget-primary" disabled={saving}>{saving ? "保存中…" : "保存这笔费用"}</button></form></div></div>;
}

function ExpenseEditControl({ slug, expense, currentMemberId, members, days }: { slug: string; expense: PersonalBudgetWorkspace["expenses"][number]; currentMemberId: string; members: Member[]; days: Day[] }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [title, setTitle] = useState(expense.title), [amount, setAmount] = useState(yuan(expense.amountMinor)), [category, setCategory] = useState<BudgetCategory>(expense.category), [dayId, setDayId] = useState(expense.dayId || ""), [occurredDate, setOccurredDate] = useState(expense.occurredDate || ""), [notes, setNotes] = useState(expense.notes || ""), [participantIds, setParticipantIds] = useState(() => expense.allocations.map((allocation) => allocation.memberId)), [allocationMode, setAllocationMode] = useState<"equal" | "custom">("custom"), [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => Object.fromEntries(expense.allocations.map((allocation) => [allocation.memberId, yuan(allocation.amountMinor)]))), [saving, setSaving] = useState(false), [error, setError] = useState("");
  function toggleParticipant(id: string) {
    setParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function save() {
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = { title, category, notes: notes || null, dayId: dayId || null, occurredDate: occurredDate || null };
      const amountMinor = toMinor(amount);
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("金额必须大于 0。");
      if (expense.scope === "personal") body.amountMinor = amountMinor;
      if (expense.scope === "shared") {
        body.amountMinor = amountMinor;
        if (allocationMode === "equal") body.participantMemberIds = participantIds;
        else body.allocations = participantIds.map((memberId) => ({ memberId, amountMinor: toMinor(customAmounts[memberId] || "0") }));
      }
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/budget/expenses/${encodeURIComponent(expense.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "更新失败");
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "更新失败"); setSaving(false); }
  }
  async function remove() {
    if (!window.confirm("只删除这一笔费用记录？")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/budget/expenses/${encodeURIComponent(expense.id)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败");
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败"); setSaving(false); }
  }
  const canEdit = expense.scope === "personal" ? expense.createdByMemberId === currentMemberId : true;
  return <details className="expense-edit"><summary>编辑 / 删除</summary><div><label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as BudgetCategory)}>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>归属日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}><option value="">不关联日期</option>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>实际日期（可选）<input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} /></label><label>金额（元）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>{expense.scope === "shared" && <fieldset><legend>共享分摊</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} /> {member.displayName}</label>)}</div><div className="budget-split-mode"><label><input type="radio" checked={allocationMode === "equal"} onChange={() => setAllocationMode("equal")} /> 平均分摊</label><label><input type="radio" checked={allocationMode === "custom"} onChange={() => setAllocationMode("custom")} /> 自定义金额</label></div>{allocationMode === "custom" && <div className="budget-custom-split">{participantIds.map((memberId) => <label key={memberId}>{members.find((member) => member.id === memberId)?.displayName}<input inputMode="decimal" value={customAmounts[memberId] || ""} onChange={(event) => setCustomAmounts((current) => ({ ...current, [memberId]: event.target.value }))} placeholder="0.00" /></label>)}</div>}</fieldset>}<label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="budget-inline-actions"><button type="button" onClick={save} disabled={saving || !canEdit}>{saving ? "保存中…" : "保存修改"}</button><button type="button" className="danger" onClick={remove} disabled={saving || !canEdit}>删除</button></div><ErrorMessage value={error} /></div></details>;
}

export function BudgetWorkspace({ slug, budget, members, days, cities = [], routeSegmentsByDay, routePreferences, costMode = "expected" }: { slug: string; budget: PersonalBudgetWorkspace | null; members: Member[]; days: Day[]; cities?: { id: string; name: string }[]; routeSegmentsByDay?: Record<string, RouteSegment[]>; routePreferences?: RoutePreference[]; costMode?: "expected" | "actual" }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [routeEstimate, setRouteEstimate] = useState<EstimateSnapshot>({ knownMinor: 0, pendingCount: 0, loadedCount: 0 });
  const onRouteEstimateChange = useCallback((next: EstimateSnapshot) => setRouteEstimate((current) => current.knownMinor === next.knownMinor && current.pendingCount === next.pendingCount && current.loadedCount === next.loadedCount ? current : next), []);
  const plans = useMemo(() => new Map((budget?.plans || []).map((plan) => [plan.category, yuan(plan.plannedAmountMinor)])), [budget]);
  const [planValues, setPlanValues] = useState<Record<string, string>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null), [planError, setPlanError] = useState("");
  if (!budget) return <section className="budget-view"><header className="workspace-view-heading"><div><span>BUDGET</span><h2>我的个人预算</h2></div></header><div className="plan-empty"><b>暂时无法读取个人预算</b><p>请先以旅行成员身份进入，或确认你已加入这条行程。</p></div></section>;
  const values = categories.reduce<Record<string, string>>((all, category) => { all[category.key] = planValues[category.key] ?? plans.get(category.key) ?? ""; return all; }, {});
  async function savePlan(category: BudgetCategory) {
    setSavingPlan(category); setPlanError("");
    try {
      const amountMinor = toMinor(values[category] || "0");
      if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("请输入有效金额。");
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/budget/plans`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ category, plannedAmountMinor: amountMinor }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败");
      refreshWorkspace();
    } catch (caught) { setPlanError(caught instanceof Error ? caught.message : "保存失败"); setSavingPlan(null); }
  }
  const totals = budget.totals;
  const expectedKnownMinor = totals.expectedMinor + routeEstimate.knownMinor;
  const expectedUnknownCount = budget.expectedUnknownCount + routeEstimate.pendingCount;
  const dayLabels = days;
  const tabHref = (mode: "expected" | "actual") => `/trips/${encodeURIComponent(slug)}/plan?view=budget&cost=${mode}`;
  const expectedMode = costMode === "expected";
  return <section className="budget-view"><header className="workspace-view-heading"><div><span>FEES · {members.find((member) => member.id === budget.memberId)?.displayName || "我"}</span><h2>我的费用</h2><p className="budget-subtitle">按当前登录成员读取；预计和实际严格分开。</p></div>{<button type="button" className="budget-primary budget-add-button" onClick={() => setShowExpenseForm(true)}>＋记一笔</button>}</header><nav className="budget-mode-tabs" aria-label="费用视图"><Link className={expectedMode ? "active" : ""} href={tabHref("expected")}>预计</Link><Link className={!expectedMode ? "active" : ""} href={tabHref("actual")}>实际</Link></nav>{expectedMode ? <><div className="budget-summary-grid"><article><span>我的已知预计</span><strong>{money(expectedKnownMinor)}</strong><small>已知订单承担 + 计划花费 + 已加载路线估算</small></article><article><span>已知订单承担</span><strong>{money(totals.fixedPersonalMinor)}</strong><small>来自 BookingCostAllocation</small></article><article><span>待补充</span><strong>{expectedUnknownCount ? `${expectedUnknownCount} 项` : "0 项"}</strong><small>没有足够金额或参与信息的计划</small></article></div><EstimatedTransport slug={slug} days={days} segmentsByDay={routeSegmentsByDay} preferences={routePreferences} currentMemberId={budget.memberId} onEstimateChange={onRouteEstimateChange}/><div className="budget-plans"><header><h3>我的计划花费</h3><span>按类别设置个人预计金额</span></header>{categories.map((category) => <div className="budget-plan-row" key={category.key}><label>{category.label}<input inputMode="decimal" value={values[category.key]} onChange={(event) => setPlanValues((current) => ({ ...current, [category.key]: event.target.value }))} placeholder="0.00" /></label><button type="button" onClick={() => savePlan(category.key)} disabled={savingPlan === category.key}>{savingPlan === category.key ? "保存中…" : "保存"}</button></div>)}<ErrorMessage value={planError} /></div></> : <div className="budget-summary-grid"><article><span>我实际花费</span><strong>{money(totals.confirmedMinor)}</strong><small>已分摊订单 + 已记录消费</small></article><article><span>已发生消费</span><strong>{money(totals.actualMinor)}</strong><small>来自 ExpenseAllocation</small></article><article><span>订单承担</span><strong>{money(totals.fixedPersonalMinor)}</strong><small>来自 BookingCostAllocation</small></article></div>}<div className="budget-bookings"><header><h3>已确认订单 · 我的承担</h3><span>订单总价不会直接算入个人费用</span></header>{budget.bookings.map((booking) => <article key={booking.id}><div><b><TransportIcon kind={iconForBookingType(booking.type, booking.title)} size={15} /> {booking.title}</b><small>{booking.pending ? "我的费用待确认" : "已记录个人分摊"}{booking.participants.length ? ` · ${booking.participants.map((member) => member.displayName).join("、")}` : ""}</small>{booking.type === "hotel" ? <small>{booking.place ? `地点：${booking.place.name}${booking.place.address ? ` · ${booking.place.address}` : ""}` : "酒店地点待确认"}</small> : null}{booking.type === "flight" || booking.type === "train" ? <small>起点：{booking.originPlace?.name || "起点待确认"} · 终点：{booking.destinationPlace?.name || "终点待确认"}</small> : null}</div><strong className={booking.pending ? "pending" : ""}>{booking.pending ? "我的费用待确认" : money(booking.ownAmountMinor)}</strong><div className="budget-booking-location-actions">{booking.type === "hotel" ? <BookingPlaceControl slug={slug} bookingId={booking.id} slot="place" cities={cities} currentPlace={booking.place} label={booking.place ? "修改地点" : "确认酒店地点"} defaultCityId={cities.find((city) => booking.place?.cityId === city.id)?.id || cities.find((city) => booking.title.includes(city.name))?.id} /> : null}{booking.type === "flight" || booking.type === "train" ? <><BookingPlaceControl slug={slug} bookingId={booking.id} slot="origin" cities={cities} currentPlace={booking.originPlace} label={booking.originPlace ? "修改起点" : "确认起点"} /><BookingPlaceControl slug={slug} bookingId={booking.id} slot="destination" cities={cities} currentPlace={booking.destinationPlace} label={booking.destinationPlace ? "修改终点" : "确认终点"} /></> : null}</div><BookingEditControl slug={slug} booking={booking} members={members} /></article>)}{!budget.bookings.length && <p className="budget-muted">暂无已确认订单。</p>}</div>{!expectedMode && <div className="budget-expenses"><header><h3>最近消费</h3><span>只显示你有权查看的费用</span></header>{budget.expenses.map((expense) => <article key={expense.id}><div><b>{expense.title}</b><small>{categoryLabel[expense.category]} · {expense.scope === "shared" ? `共享 · ${expense.payerName ? `${expense.payerName}付款` : "付款人待定"}` : "个人"}</small><small>{expense.occurredDate ? `发生于 ${expense.occurredDate}` : "日期待确认"}</small></div><strong>{money(expense.ownAmountMinor)}</strong><ExpenseEditControl slug={slug} expense={expense} currentMemberId={budget.memberId} members={members} days={dayLabels} /></article>)}{!budget.expenses.length && <p className="budget-muted">还没有消费记录，点击“＋记一笔”开始。</p>}</div>}<p className="budget-disclaimer">订单费用来自成员分摊；实际消费来自 ExpenseAllocation。预计视图不会把预计金额写入实际费用，也不显示“剩余可花”。</p>{showExpenseForm && <ExpenseForm slug={slug} members={members} days={dayLabels} currentMemberId={budget.memberId} onClose={() => setShowExpenseForm(false)} />}</section>;
}
