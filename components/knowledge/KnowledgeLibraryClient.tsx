/* eslint-disable @next/next/no-img-element */
"use client";
import { useRef, useState } from "react";
import { BookOpenText, Camera, Film, Heart, MoreHorizontal, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { knowledgeHref, type KnowledgeQuery } from "@/services/knowledge-navigation";
import { EditorDialog } from "@/components/trip/EditorDialog";
import { editorRequest } from "@/components/trip/editor-request";
import { uploadMediaFile } from "@/components/media/client-upload";
import { KnowledgePlaceEditor } from "./KnowledgePlaceEditor";
import type { KnowledgeEntryView, KnowledgePlaceChoice } from "@/services/knowledge-service.server";

const sections = { photography: { label: "拍照知识", icon: Camera }, transition_video: { label: "转场视频", icon: Film }, travel_guide: { label: "旅游攻略", icon: BookOpenText } } as const;
const blank = { section: "photography", title: "", summary: "", body: "", destination: "", externalUrl: "", tags: "", mediaAssetIds: [] as string[], places: [] as KnowledgePlaceChoice[] };
export function KnowledgeLibraryClient({ entries, initialSection = "", favoriteOnly = false, query = {}, tags = [], page = 1, hasMore = false }: { entries: KnowledgeEntryView[]; initialSection?: string; favoriteOnly?: boolean; query?: KnowledgeQuery; tags?: string[]; page?: number; hasMore?: boolean }) {
  const router = useRouter(); const [open, setOpen] = useState(false), [editing, setEditing] = useState<KnowledgeEntryView | null>(null), [form, setForm] = useState(blank), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [baseline, setBaseline] = useState(""), [busyAction, setBusyAction] = useState("");
  const [deleting, setDeleting] = useState<KnowledgeEntryView | null>(null);
  const actionPending = useRef(false), uploadPending = useRef(false);
  function start(entry?: KnowledgeEntryView) {
    const next = entry ? { section: entry.section, title: entry.title, summary: entry.summary || "", body: entry.body || "", destination: entry.destination || "", externalUrl: entry.externalUrl || "", tags: entry.tags.join("，"), mediaAssetIds: entry.mediaAssetIds, places: entry.places } : { ...blank, section: initialSection && initialSection in sections ? initialSection : "photography" };
    setEditing(entry || null); setForm(next); setBaseline(JSON.stringify(next)); setError(""); setOpen(true);
  }
  function close() { if (!saving) setOpen(false); }
  async function submit() { if (saving) return; setSaving(true); setError(""); try { await editorRequest(editing ? `/api/knowledge/${editing.id}` : "/api/knowledge", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, placeIds: form.places.map((place) => place.id), tags: form.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean) }) }); setOpen(false); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); } finally { setSaving(false); } }
  async function upload(files: readonly File[]) {
    if (!files?.length || saving || uploadPending.current) return;
    const selected = [...files].slice(0, Math.max(0, 12 - form.mediaAssetIds.length));
    if (!selected.length) { setError("图片已达上限。"); return; }
    uploadPending.current = true; setSaving(true); setError("");
    try { for (const file of selected) { const id = await uploadMediaFile(file, "knowledge_image"); setForm(current => ({ ...current, mediaAssetIds: [...current.mediaAssetIds, id] })); } }
    catch (caught) { setError(`${caught instanceof Error ? caught.message : "图片上传失败。"} 已成功的图片已保留。`); }
    finally { uploadPending.current = false; setSaving(false); }
  }
  async function mutate(url: string, init: RequestInit, action: string) {
    if (actionPending.current) return false;
    actionPending.current = true; setBusyAction(action); setError("");
    try { await editorRequest(url, init); router.refresh(); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "操作失败，请重试。"); return false; }
    finally { actionPending.current = false; setBusyAction(""); }
  }
  async function favorite(entry: KnowledgeEntryView) { await mutate(`/api/knowledge/${entry.id}/favorite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorite: !entry.favorite }) }, `favorite:${entry.id}`); }
  function remove(entry: KnowledgeEntryView) { if (!busyAction) { setError(""); setDeleting(entry); } }
  return <>
    {error && !open && !deleting && <p className="form-error" role="alert">{error}</p>}
    <div className="knowledge-toolbar"><nav><Link className={!initialSection ? "active" : ""} href={knowledgeHref(query, { section: "" })}>全部</Link>{Object.entries(sections).map(([key, value]) => <Link className={initialSection === key ? "active" : ""} key={key} href={knowledgeHref(query, { section: key })}>{value.label}</Link>)}<Link className={favoriteOnly ? "active" : ""} href={knowledgeHref(query, { favorite: favoriteOnly ? "" : "1" })}>收藏</Link></nav>{tags.length ? <div className="knowledge-tag-row">{tags.map((tag) => <Link className={query.tag === tag ? "active" : ""} key={tag} href={knowledgeHref(query, { tag: query.tag === tag ? "" : tag })}>#{tag}</Link>)}</div> : null}{Object.values(query).some(Boolean) && <Link href="/knowledge">清除筛选</Link>}</div>
    <button type="button" className="global-floating-add knowledge-floating-add" aria-label="添加知识" onClick={() => start()}><Plus size={30} /></button>
    {!entries.length ? <section className="knowledge-empty"><BookOpenText size={62} /><h2>暂无内容</h2><button type="button" onClick={() => start()}>添加知识</button></section> : <section className="knowledge-grid">{entries.map((entry) => { const meta = sections[entry.section]; const Icon = meta.icon; const mediaCover = entry.coverMediaAssetId || entry.mediaAssetIds[0]; const coverSrc = mediaCover ? `/api/media/${mediaCover}?variant=card` : entry.coverImageUrl; return <article className="knowledge-card" key={entry.id}>{coverSrc ? <Link href={`/knowledge/${entry.id}`} className="knowledge-card-cover"><img src={coverSrc} alt="" loading="lazy" /></Link> : <Link href={`/knowledge/${entry.id}`} className="knowledge-card-cover empty"><Icon size={42} /></Link>}<div className="knowledge-card-body"><span><Icon size={15} />{meta.label}</span><Link href={`/knowledge/${entry.id}`}><h2>{entry.title}</h2></Link>{entry.summary && <p>{entry.summary}</p>}<div className="knowledge-card-meta">{entry.destination && <small>{entry.destination}</small>}{entry.tags.map((tag) => <small key={tag}>#{tag}</small>)}</div></div><div className="knowledge-card-actions"><button type="button" disabled={!!busyAction} aria-label={entry.favorite ? "取消收藏" : "收藏"} onClick={() => favorite(entry)}><Heart size={18} fill={entry.favorite ? "currentColor" : "none"} /></button><button type="button" disabled={!!busyAction} aria-label="编辑知识" onClick={() => start(entry)}><MoreHorizontal size={18} /></button><button type="button" disabled={!!busyAction} onClick={() => remove(entry)}>删除</button></div></article>; })}</section>}
    {(page > 1 || hasMore) && <nav className="knowledge-pagination" aria-label="知识分页">{page > 1 && <Link href={knowledgeHref(query, { page: String(page - 1) })}>上一页</Link>}<span>第 {page} 页</span>{hasMore && <Link href={knowledgeHref(query, { page: String(page + 1) })}>下一页</Link>}</nav>}
    {open && <EditorDialog open title={editing ? "编辑知识" : "添加知识"} onClose={close} dirty={JSON.stringify(form) !== baseline} busy={saving} onSubmit={submit}><label>栏目<select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>{Object.entries(sections).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><label>标题<input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>简短说明<input maxLength={500} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label><label>正文<textarea rows={7} maxLength={12000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label><div className="knowledge-editor-row"><label>目的地<input maxLength={100} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></label><label>标签<input placeholder="人像，夜景" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label></div><KnowledgePlaceEditor places={form.places} disabled={saving} onBusyChange={setSaving} onChange={(places) => setForm((current) => ({ ...current, places }))} /><label>外部链接<input type="url" placeholder="https://" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} /></label>{form.mediaAssetIds.length ? <div className="knowledge-editor-images">{form.mediaAssetIds.map((id) => <div key={id}><img src={`/api/media/${id}?variant=thumb`} alt="" /><button type="button" aria-label="移除图片" onClick={() => setForm((current) => ({ ...current, mediaAssetIds: current.mediaAssetIds.filter((item) => item !== id) }))}><X size={15} /></button></div>)}</div> : null}<label className="knowledge-upload">图片<input type="file" multiple disabled={saving} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ""; void upload(files); }} /><span>{form.mediaAssetIds.length ? `继续添加（已有 ${form.mediaAssetIds.length} 张）` : "选择图片"}</span></label>{error && <p role="alert" className="form-error">{error}</p>}</EditorDialog>}
    {deleting && <EditorDialog open title="删除知识" onClose={() => { setDeleting(null); setError(""); }} busy={!!busyAction} submitLabel="确认删除" onSubmit={async () => { if (await mutate(`/api/knowledge/${deleting.id}`, { method: "DELETE" }, `delete:${deleting.id}`)) setDeleting(null); }}><p>确定删除“{deleting.title}”吗？</p>{error && <p className="form-error" role="alert">{error}</p>}</EditorDialog>}
  </>;
}

