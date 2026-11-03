"use client";
import { useClientReady } from "./useClientReady";

import { useCallback, useMemo, useState } from "react";
import { DeferredEditor } from "./DeferredEditor";
import type { BudgetBookingEditorProps, ExpenseEditorProps } from "./BudgetEditors";
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

const loadBookingEditor = () => import("./BudgetEditors").then(module => ({ default: module.BudgetBookingEditor }));
const loadExpenseEditor = () => import("./BudgetEditors").then(module => ({ default: module.ExpenseEditor }));
const loadExpenseForm = () => import("./BudgetEditors").then(module => ({ default: module.ExpenseForm }));

function BookingEditControl(props: Omit<BudgetBookingEditorProps, "onClose">) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  return <><button type="button" className="inline-edit-trigger" aria-haspopup="dialog" aria-expanded={open} disabled={!ready} onClick={() => setOpen(true)}>编辑订单信息</button>
    {open && <DeferredEditor load={loadBookingEditor} title="编辑订单信息" editorProps={{ ...props, onClose: () => setOpen(false) }} />}</>;
}
function ExpenseEditControl(props: Omit<ExpenseEditorProps, "onClose">) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const canEdit = props.expense.scope !== "personal" || props.expense.createdByMemberId === props.currentMemberId;
  return <><button type="button" className="inline-edit-trigger" aria-haspopup="dialog" aria-expanded={open} disabled={!ready || !canEdit} onClick={() => setOpen(true)}>编辑费用</button>
    {open && <DeferredEditor load={loadExpenseEditor} title="编辑费用" editorProps={{ ...props, onClose: () => setOpen(false) }} />}</>;
}

export function BudgetWorkspace({ slug, budget, members, days, cities = [], routeSegmentsByDay, routePreferences, costMode = "expected" }: { slug: string; budget: PersonalBudgetWorkspace | null; members: Member[]; days: Day[]; cities?: { id: string; name: string }[]; routeSegmentsByDay?: Record<string, RouteSegment[]>; routePreferences?: RoutePreference[]; costMode?: "expected" | "actual" }) {
  const ready = useClientReady();
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
    } catch (caught) { setPlanError(caught instanceof Error ? caught.message : "保存失败"); }
    finally { setSavingPlan(null); }
  }
  const totals = budget.totals;
  const expectedKnownMinor = totals.expectedMinor + routeEstimate.knownMinor;
  const expectedUnknownCount = budget.expectedUnknownCount + routeEstimate.pendingCount;
  const dayLabels = days;
  const tabHref = (mode: "expected" | "actual") => `/trips/${encodeURIComponent(slug)}/plan?view=budget&cost=${mode}`;
  const expectedMode = costMode === "expected";
  return <section className="budget-view"><header className="workspace-view-heading"><div><span>FEES · {members.find((member) => member.id === budget.memberId)?.displayName || "我"}</span><h2>我的费用</h2></div>{<button type="button" className="budget-primary budget-add-button" disabled={!ready} onClick={() => setShowExpenseForm(true)}>＋记一笔</button>}</header><nav className="budget-mode-tabs" aria-label="费用视图"><Link className={expectedMode ? "active" : ""} href={tabHref("expected")}>预计</Link><Link className={!expectedMode ? "active" : ""} href={tabHref("actual")}>实际</Link></nav>{expectedMode ? <><div className="budget-summary-grid"><article><span>我的已知预计</span><strong>{money(expectedKnownMinor)}</strong><small>已知订单承担 + 计划花费 + 已加载路线估算</small></article><article><span>已知订单承担</span><strong>{money(totals.fixedPersonalMinor)}</strong><small>按订单中的个人分摊计算</small></article><article><span>待补充</span><strong>{expectedUnknownCount ? `${expectedUnknownCount} 项` : "0 项"}</strong><small>没有足够金额或参与信息的计划</small></article></div><EstimatedTransport slug={slug} days={days} segmentsByDay={routeSegmentsByDay} preferences={routePreferences} currentMemberId={budget.memberId} onEstimateChange={onRouteEstimateChange}/><div className="budget-plans"><header><h3>我的计划花费</h3><span>按类别设置个人预计金额</span></header>{categories.map((category) => <div className="budget-plan-row" key={category.key}><label>{category.label}<input inputMode="decimal" value={values[category.key]} onChange={(event) => setPlanValues((current) => ({ ...current, [category.key]: event.target.value }))} placeholder="0.00" /></label><button type="button" onClick={() => savePlan(category.key)} disabled={savingPlan === category.key}>{savingPlan === category.key ? "保存中…" : "保存"}</button></div>)}<ErrorMessage value={planError} /></div></> : <div className="budget-summary-grid"><article><span>我实际花费</span><strong>{money(totals.confirmedMinor)}</strong><small>已分摊订单 + 已记录消费</small></article><article><span>已发生消费</span><strong>{money(totals.actualMinor)}</strong><small>按已记录消费中的个人分摊计算</small></article><article><span>订单承担</span><strong>{money(totals.fixedPersonalMinor)}</strong><small>按订单中的个人分摊计算</small></article></div>}<div className="budget-bookings"><header><h3>已确认订单 · 我的承担</h3><span>订单总价不会直接算入个人费用</span></header>{budget.bookings.map((booking) => <article key={booking.id}><div><b><TransportIcon kind={iconForBookingType(booking.type, booking.title)} size={15} /> {booking.title}</b><small>{booking.pending ? "我的费用待确认" : "已记录个人分摊"}{booking.participants.length ? ` · ${booking.participants.map((member) => member.displayName).join("、")}` : ""}</small>{booking.type === "hotel" ? <small>{booking.place ? `地点：${booking.place.name}${booking.place.address ? ` · ${booking.place.address}` : ""}` : "酒店地点待确认"}</small> : null}{booking.type === "flight" || booking.type === "train" ? <small>起点：{booking.originPlace?.name || "起点待确认"} · 终点：{booking.destinationPlace?.name || "终点待确认"}</small> : null}</div><strong className={booking.pending ? "pending" : ""}>{booking.pending ? "我的费用待确认" : money(booking.ownAmountMinor)}</strong><div className="budget-booking-location-actions">{booking.type === "hotel" ? <BookingPlaceControl slug={slug} bookingId={booking.id} slot="place" cities={cities} currentPlace={booking.place} label={booking.place ? "修改地点" : "确认酒店地点"} defaultCityId={cities.find((city) => booking.place?.cityId === city.id)?.id || cities.find((city) => booking.title.includes(city.name))?.id} /> : null}{booking.type === "flight" || booking.type === "train" ? <><BookingPlaceControl slug={slug} bookingId={booking.id} slot="origin" cities={cities} currentPlace={booking.originPlace} label={booking.originPlace ? "修改起点" : "确认起点"} /><BookingPlaceControl slug={slug} bookingId={booking.id} slot="destination" cities={cities} currentPlace={booking.destinationPlace} label={booking.destinationPlace ? "修改终点" : "确认终点"} /></> : null}</div><BookingEditControl slug={slug} booking={booking} members={members} /></article>)}{!budget.bookings.length && <p className="budget-muted">暂无已确认订单。</p>}</div>{!expectedMode && <div className="budget-expenses"><header><h3>最近消费</h3><span>只显示你有权查看的费用</span></header>{budget.expenses.map((expense) => <article key={expense.id}><div><b>{expense.title}</b><small>{categoryLabel[expense.category]} · {expense.scope === "shared" ? `共享 · ${expense.payerName ? `${expense.payerName}付款` : "付款人待定"}` : "个人"}</small><small>{expense.occurredDate ? `发生于 ${expense.occurredDate}` : "日期待确认"}</small></div><strong>{money(expense.ownAmountMinor)}</strong><ExpenseEditControl slug={slug} expense={expense} currentMemberId={budget.memberId} members={members} days={dayLabels} /></article>)}{!budget.expenses.length && <p className="budget-muted">还没有消费记录，点击“＋记一笔”开始。</p>}</div>}<p className="budget-disclaimer">订单费用来自成员分摊；实际消费按已记录消费中的个人分摊计算。预计视图不会把预计金额写入实际费用，也不显示“剩余可花”。</p>{showExpenseForm && <DeferredEditor load={loadExpenseForm} title="记一笔" editorProps={{ slug, members, days: dayLabels, currentMemberId: budget.memberId, onClose: () => setShowExpenseForm(false) }} />}</section>;
}
