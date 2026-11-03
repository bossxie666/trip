"use client";
import { useRef, useState } from "react";
import { EditorDialog } from "./EditorDialog";
import { editorRequest } from "./editor-request";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import type { PersonalBudgetWorkspace } from "@/services/budget-service.server";
import type { BudgetCategory } from "@/models/planning";
type Member = { id: string; displayName: string };
type Day = { id: string; label: string };

const categories: { key: BudgetCategory; label: string }[] = [
  { key: "food", label: "吃饭" },
  { key: "local_transport", label: "市内交通" },
  { key: "entertainment", label: "娱乐" },
  { key: "shopping", label: "购物" },
  { key: "other", label: "其他" },
];
const money = (minor: number | null | undefined) => minor == null ? "—" : `¥${(minor / 100).toFixed(2).replace(/\.00$/, "")}`;
const yuan = (minor: number | null | undefined) => minor == null ? "" : (minor / 100).toFixed(2);
const toMinor = (value: string) => { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 100) : NaN; };

const sortedIds = (ids: string[]) => [...ids].sort();

function ErrorMessage({ value }: { value: string }) { return value ? <p className="budget-error" role="alert">{value}</p> : null; }

export type BudgetBookingEditorProps = { slug: string; booking: PersonalBudgetWorkspace["bookings"][number]; members: Member[]; onClose: () => void };
export function BudgetBookingEditor({ slug, booking, members, onClose }: BudgetBookingEditorProps) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [title, setTitle] = useState(booking.title), [status, setStatus] = useState(booking.status), [amount, setAmount] = useState(yuan(booking.totalAmountMinor)), [participantIds, setParticipantIds] = useState(booking.participants.map((member) => member.memberId)), [allocationModes, setAllocationModes] = useState<Record<string, "equal" | "custom">>(() => Object.fromEntries(booking.costLines.map((line) => [line.id, line.allocationMode]))), [allocationMembers, setAllocationMembers] = useState<Record<string, string[]>>(() => Object.fromEntries(booking.costLines.map((line) => [line.id, line.allocations.map((allocation) => allocation.memberId)]))), [allocationAmounts, setAllocationAmounts] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(booking.costLines.map((line) => [line.id, Object.fromEntries(line.allocations.map((allocation) => [allocation.memberId, yuan(allocation.amountMinor)]))]))), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  const initial = () => ({ title: booking.title, status: booking.status, amount: yuan(booking.totalAmountMinor), participantIds: sortedIds(booking.participants.map(member => member.memberId)), allocationModes: Object.fromEntries(booking.costLines.map(line => [line.id, line.allocationMode])), allocationMembers: Object.fromEntries(booking.costLines.map(line => [line.id, sortedIds(line.allocations.map(allocation => allocation.memberId))])), allocationAmounts: Object.fromEntries(booking.costLines.map(line => [line.id, Object.fromEntries(line.allocations.map(allocation => [allocation.memberId, yuan(allocation.amountMinor)]))])) });
  const dirty = JSON.stringify({ title, status, amount, participantIds: sortedIds(participantIds), allocationModes, allocationMembers: Object.fromEntries(Object.entries(allocationMembers).map(([id, ids]) => [id, sortedIds(ids)])), allocationAmounts }) !== JSON.stringify(initial());

  function toggleParticipant(id: string) { setParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleAllocationMember(lineId: string, id: string) { setAllocationMembers((current) => ({ ...current, [lineId]: (current[lineId] || []).includes(id) ? (current[lineId] || []).filter((item) => item !== id) : [...(current[lineId] || []), id] })); }
  async function save() {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const costLineAllocations = booking.costLines.map((line) => allocationModes[line.id] === "equal" ? { costLineId: line.id, allocationMode: "equal", memberIds: allocationMembers[line.id] || [] } : { costLineId: line.id, allocationMode: "custom", allocations: (allocationMembers[line.id] || []).map((memberId) => ({ memberId, amountMinor: toMinor(allocationAmounts[line.id]?.[memberId] || "0") })) });
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/budget/bookings/${encodeURIComponent(booking.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, status, totalAmountMinor: amount ? toMinor(amount) : null, participantMemberIds: participantIds, costLineAllocations }) });
      onClose(); refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "订单更新失败"); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <EditorDialog open title="编辑订单信息" onClose={() => onClose()} dirty={dirty} busy={saving} onSubmit={save} submitLabel="保存订单"><label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="tentative">待确认</option><option value="confirmed">已确认</option><option value="cancelled">已取消</option></select></label><label>订单总额（元）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><fieldset><legend>订单使用成员</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} /> {member.displayName}</label>)}</div></fieldset>{booking.costLines.map((line) => { const allocationMode = allocationModes[line.id] || line.allocationMode; return <fieldset key={line.id}><legend>{line.title} · {allocationMode === "equal" ? "平均分摊" : "自定义分摊"}（{money(line.amountMinor)}）</legend><div className="budget-split-mode"><label><input type="radio" name={`booking-split-${line.id}`} checked={allocationMode === "equal"} onChange={() => setAllocationModes((current) => ({ ...current, [line.id]: "equal" }))} /> 平均分摊</label><label><input type="radio" name={`booking-split-${line.id}`} checked={allocationMode === "custom"} onChange={() => setAllocationModes((current) => ({ ...current, [line.id]: "custom" }))} /> 自定义金额</label></div><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={(allocationMembers[line.id] || []).includes(member.id)} onChange={() => toggleAllocationMember(line.id, member.id)} /> {member.displayName}</label>)}</div>{allocationMode === "custom" && <div className="budget-custom-split">{(allocationMembers[line.id] || []).map((memberId) => <label key={memberId}>{members.find((member) => member.id === memberId)?.displayName}<input inputMode="decimal" value={allocationAmounts[line.id]?.[memberId] || ""} onChange={(event) => setAllocationAmounts((current) => ({ ...current, [line.id]: { ...(current[line.id] || {}), [memberId]: event.target.value } }))} placeholder="0.00" /></label>)}</div>}</fieldset>; })}<ErrorMessage value={error} /></EditorDialog>;
}

export function ExpenseForm({ slug, members, days, currentMemberId, onClose }: { slug: string; members: Member[]; days: Day[]; currentMemberId: string; onClose: () => void }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [title, setTitle] = useState(""), [amount, setAmount] = useState(""), [category, setCategory] = useState<BudgetCategory>("food"), [scope, setScope] = useState<"personal" | "shared">("personal"), [dayId, setDayId] = useState(days[0]?.id || ""), [occurredDate, setOccurredDate] = useState(""), [paidByMemberId, setPaidByMemberId] = useState(currentMemberId), [participantIds, setParticipantIds] = useState<string[]>(members.map((member) => member.id)), [allocationMode, setAllocationMode] = useState<"equal" | "custom">("equal"), [customAmounts, setCustomAmounts] = useState<Record<string, string>>({}), [notes, setNotes] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  const dirty = Boolean(title || amount || occurredDate || notes || category !== "food" || scope !== "personal" || dayId !== (days[0]?.id || "") || paidByMemberId !== currentMemberId || allocationMode !== "equal" || Object.keys(customAmounts).length || JSON.stringify(sortedIds(participantIds)) !== JSON.stringify(sortedIds(members.map(member => member.id))));
  function toggleParticipant(id: string) { setParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const amountMinor = toMinor(amount);
      const allocations = scope === "shared" && allocationMode === "custom" ? participantIds.map((memberId) => ({ memberId, amountMinor: toMinor(customAmounts[memberId] || "0") })) : undefined;
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("金额必须大于 0。");
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/budget/expenses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, amountMinor, category, scope, dayId: dayId || null, occurredDate: occurredDate || null, paidByMemberId: scope === "shared" ? paidByMemberId : currentMemberId, participantMemberIds: scope === "shared" && allocationMode === "equal" ? participantIds : undefined, allocations, notes: notes || null }) });
      onClose();
      refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <EditorDialog open title="记一笔" onClose={onClose} dirty={dirty} busy={saving} onSubmit={submit} submitLabel="保存这笔费用"><label>费用名称<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：晚餐" /></label><div className="budget-form-grid"><label>金额（元）<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as BudgetCategory)}>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div><label>归属日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}><option value="">不关联日期</option>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>实际日期（可选）<input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} /></label><fieldset><legend>费用类型</legend><label><input type="radio" checked={scope === "personal"} onChange={() => setScope("personal")} /> 我的个人费用</label><label><input type="radio" checked={scope === "shared"} onChange={() => setScope("shared")} /> 共享费用</label></fieldset>{scope === "shared" && <><label>实际付款人<select value={paidByMemberId} onChange={(event) => setPaidByMemberId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><fieldset><legend>参与分摊</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} /> {member.displayName}</label>)}</div><div className="budget-split-mode"><label><input type="radio" checked={allocationMode === "equal"} onChange={() => setAllocationMode("equal")} /> 平均分摊</label><label><input type="radio" checked={allocationMode === "custom"} onChange={() => setAllocationMode("custom")} /> 自定义金额</label></div>{allocationMode === "custom" && <div className="budget-custom-split">{participantIds.map((memberId) => <label key={memberId}>{members.find((member) => member.id === memberId)?.displayName}<input inputMode="decimal" value={customAmounts[memberId] || ""} onChange={(event) => setCustomAmounts((current) => ({ ...current, [memberId]: event.target.value }))} placeholder="0.00" /></label>)}</div>}</fieldset></>}<label>备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><ErrorMessage value={error} /></EditorDialog>;
}

export type ExpenseEditorProps = { slug: string; expense: PersonalBudgetWorkspace["expenses"][number]; currentMemberId: string; members: Member[]; days: Day[]; onClose: () => void };
export function ExpenseEditor({ slug, expense, currentMemberId, members, days, onClose }: ExpenseEditorProps) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [title, setTitle] = useState(expense.title), [amount, setAmount] = useState(yuan(expense.amountMinor)), [category, setCategory] = useState<BudgetCategory>(expense.category), [dayId, setDayId] = useState(expense.dayId || ""), [occurredDate, setOccurredDate] = useState(expense.occurredDate || ""), [notes, setNotes] = useState(expense.notes || ""), [participantIds, setParticipantIds] = useState(() => expense.allocations.map((allocation) => allocation.memberId)), [allocationMode, setAllocationMode] = useState<"equal" | "custom">("custom"), [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => Object.fromEntries(expense.allocations.map((allocation) => [allocation.memberId, yuan(allocation.amountMinor)]))), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const submitting = useRef(false);
  const initialAmounts = () => Object.fromEntries(expense.allocations.map(allocation => [allocation.memberId, yuan(allocation.amountMinor)]));
  const dirty = title !== expense.title || amount !== yuan(expense.amountMinor) || category !== expense.category || dayId !== (expense.dayId || "") || occurredDate !== (expense.occurredDate || "") || notes !== (expense.notes || "") || allocationMode !== "custom" || JSON.stringify(sortedIds(participantIds)) !== JSON.stringify(sortedIds(expense.allocations.map(allocation => allocation.memberId))) || JSON.stringify(customAmounts) !== JSON.stringify(initialAmounts());

  function toggleParticipant(id: string) {
    setParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function save() {
    if (submitting.current || !canEdit) return;
    submitting.current = true; setSaving(true); setError("");
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
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/budget/expenses/${encodeURIComponent(expense.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      onClose(); refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "更新失败"); }
    finally { submitting.current = false; setSaving(false); }
  }
  async function remove() {
    if (submitting.current || !canEdit) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      await editorRequest(`/api/trips/${encodeURIComponent(slug)}/budget/expenses/${encodeURIComponent(expense.id)}`, { method: "DELETE" });
      onClose(); refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败"); }
    finally { submitting.current = false; setSaving(false); }
  }
  const canEdit = expense.scope === "personal" ? expense.createdByMemberId === currentMemberId : true;
  return <EditorDialog open title={deleting ? "删除费用" : "编辑费用"} onClose={() => { if (deleting) { setDeleting(false); setError(""); } else onClose(); }} dirty={!deleting && dirty} busy={saving} onSubmit={deleting ? remove : save} submitLabel={deleting ? "确认删除" : "保存修改"} actions={!deleting ? <button type="button" className="danger" onClick={() => { setError(""); setDeleting(true); }} disabled={saving || !canEdit}>删除费用</button> : null}>{deleting ? <p>确定删除“{expense.title}”这笔费用记录吗？</p> : <><label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as BudgetCategory)}>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>归属日期<select value={dayId} onChange={(event) => setDayId(event.target.value)}><option value="">不关联日期</option>{days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>实际日期（可选）<input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} /></label><label>金额（元）<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>{expense.scope === "shared" && <fieldset><legend>共享分摊</legend><div className="budget-member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" checked={participantIds.includes(member.id)} onChange={() => toggleParticipant(member.id)} /> {member.displayName}</label>)}</div><div className="budget-split-mode"><label><input type="radio" checked={allocationMode === "equal"} onChange={() => setAllocationMode("equal")} /> 平均分摊</label><label><input type="radio" checked={allocationMode === "custom"} onChange={() => setAllocationMode("custom")} /> 自定义金额</label></div>{allocationMode === "custom" && <div className="budget-custom-split">{participantIds.map((memberId) => <label key={memberId}>{members.find((member) => member.id === memberId)?.displayName}<input inputMode="decimal" value={customAmounts[memberId] || ""} onChange={(event) => setCustomAmounts((current) => ({ ...current, [memberId]: event.target.value }))} placeholder="0.00" /></label>)}</div>}</fieldset>}<label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label></>}<ErrorMessage value={error} /></EditorDialog>;
}

