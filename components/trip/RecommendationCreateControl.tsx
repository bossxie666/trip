"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { uploadMediaFile } from "@/components/media/client-upload";
import type { GenericPlaceChoice } from "./GenericPlacePicker";
import { requestTripModalOpen, useExclusiveTripModal } from "./modal-events";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

const GenericPlacePicker = dynamic(() => import("./GenericPlacePicker").then((module) => module.GenericPlacePicker), { ssr: false });
const WorkspaceOverlay = dynamic(() => import("./WorkspaceOverlay").then((module) => module.WorkspaceOverlay), { ssr: false });

type Entry = "menu" | "place" | "guide" | "xiaohongshu";
type Category = "attraction" | "food" | "shopping" | "other";
type Preview = { verified?: boolean; sourceUrl?: string; title?: string | null; author?: string | null; summary?: string | null; imageUrls?: string[]; error?: string };

function placePayload(place: GenericPlaceChoice) {
  return place.source === "existing" ? { placeId: place.id } : { providerPlaceId: place.providerPlaceId || place.id };
}

export function RecommendationCreateControl({ slug, cities, existingPlaces = [] }: { slug: string; cities: { id: string; name: string }[]; existingPlaces?: GenericPlaceChoice[] }) {
  const { refreshWorkspace } = useWorkspaceNavigation();
  const [open, setOpen] = useState(false), [entry, setEntry] = useState<Entry>("menu"), [saving, setSaving] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState("");
  const [title, setTitle] = useState(""), [summary, setSummary] = useState(""), [category, setCategory] = useState<Category>("attraction"), [guideType, setGuideType] = useState<"day_trip" | "theme">("day_trip"), [duration, setDuration] = useState(""), [sourceUrl, setSourceUrl] = useState(""), [author, setAuthor] = useState("");
  const [place, setPlace] = useState<GenericPlaceChoice | null>(null), [componentDraft, setComponentDraft] = useState<GenericPlaceChoice | null>(null), [components, setComponents] = useState<GenericPlaceChoice[]>([]), [xhsKind, setXhsKind] = useState<"place" | "guide">("guide"), [screenshots, setScreenshots] = useState<File[]>([]), [previewImages, setPreviewImages] = useState<string[]>([]);
  const modalOwner = `recommendation-create:${slug}`;
  useExclusiveTripModal(modalOwner, () => setOpen(false));

  function reset() {
    setEntry("menu"); setTitle(""); setSummary(""); setCategory("attraction"); setGuideType("day_trip"); setDuration(""); setSourceUrl(""); setAuthor(""); setPlace(null); setComponentDraft(null); setComponents([]); setXhsKind("guide"); setScreenshots([]); setPreviewImages([]); setError("");
  }
  function openControl() { reset(); setSaving(false); requestTripModalOpen(modalOwner); setOpen(true); }
  function addComponent() {
    if (!componentDraft || components.some((item) => item.id === componentDraft.id && item.source === componentDraft.source)) return;
    setComponents((current) => [...current, componentDraft]); setComponentDraft(null);
  }
  function moveComponent(index: number, direction: -1 | 1) {
    setComponents((current) => { const next = [...current], target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  async function previewXhs() {
    if (!sourceUrl.trim()) { setError("请先粘贴小红书链接。"); return; }
    setReading(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/recommendations/xiaohongshu/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: sourceUrl.trim() }) });
      const result = await response.json() as Preview;
      if (!response.ok) throw new Error(result.error || "链接读取失败。");
      if (result.sourceUrl) setSourceUrl(result.sourceUrl);
      if (result.title) setTitle(result.title);
      if (result.author) setAuthor(result.author);
      if (result.summary) setSummary(result.summary);
      setPreviewImages(result.imageUrls || []);
      if (!result.verified) setError(result.error || "原帖公开信息无法可靠读取，请手动补充。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "链接读取失败，可继续手动填写。"); }
    finally { setReading(false); }
  }
  async function submit() {
    const kind = entry === "place" ? "place" : entry === "guide" ? "guide" : xhsKind;
    if (!title.trim()) { setError("请填写素材标题。"); return; }
    if (kind === "place" && !place) { setError("请通过高德地点选择器确认真实地点。"); return; }
    if (kind === "guide" && !components.length) { setError("请至少加入一个真实地点，并确认建议顺序。"); return; }
    if (entry === "xiaohongshu" && !sourceUrl.trim()) { setError("请保留真实的小红书原帖链接。"); return; }
    setSaving(true); setError("");
    try {
      const mediaAssetIds: string[] = [];
      for (const file of screenshots) mediaAssetIds.push(await uploadMediaFile(file, "recommendation_reference"));
      const selected = kind === "place" ? place : components[0];
      const cityName = selected?.cityName || cities[0]?.name || null;
      const body = {
        kind,
        guideType: kind === "guide" && guideType === "day_trip" ? "day_trip" : null,
        category,
        title: title.trim(),
        summary: summary.trim() || null,
        estimatedDurationMinutes: kind === "guide" && duration ? Math.round(Number(duration) * 60) : null,
        areaKey: cityName?.includes("上海") ? "shanghai" : cityName?.includes("杭州") ? "hangzhou" : null,
        areaLabel: cityName,
        place: kind === "place" && place ? placePayload(place) : null,
        components: kind === "guide" ? components.map(placePayload) : [],
        reference: sourceUrl.trim() ? { platform: entry === "xiaohongshu" ? "xiaohongshu" : "web", authorLabel: author.trim() || null, title: title.trim(), sourceUrl: sourceUrl.trim(), note: summary.trim() || null, imageUrls: previewImages, mediaAssetIds } : null,
      };
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/recommendations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "素材保存失败。");
      setOpen(false); reset(); refreshWorkspace();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "素材保存失败。"); }
    finally { setSaving(false); }
  }

  const isGuide = entry === "guide" || (entry === "xiaohongshu" && xhsKind === "guide");
  const isPlace = entry === "place" || (entry === "xiaohongshu" && xhsKind === "place");
  return <>
    <button type="button" className="recommendation-create-trigger" onClick={openControl}>＋ 添加素材</button>
    {open && <WorkspaceOverlay open={open} onClose={() => setOpen(false)} ariaLabel="添加攻略素材" className="recommendation-create-sheet" mode="modal">
      <header><div><span>ADD MATERIAL</span><h3>{entry === "menu" ? "添加攻略素材" : entry === "place" ? "添加地点" : entry === "guide" ? "添加攻略" : "添加小红书"}</h3><p>新增素材先进入资料库，不会自动加入 Day。</p></div><button type="button" className="workspace-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button></header>
      {entry === "menu" ? <div className="recommendation-entry-grid">
        <button type="button" onClick={() => setEntry("place")}><b>添加地点</b><small>高德确认真实 Place</small></button>
        <button type="button" onClick={() => setEntry("guide")}><b>添加攻略</b><small>多个地点与建议顺序</small></button>
        <button type="button" onClick={() => setEntry("xiaohongshu")}><b>添加小红书</b><small>真实链接 + 人工确认</small></button>
      </div> : <div className="recommendation-create-form">
        <button type="button" className="recommendation-create-back" onClick={() => { setEntry("menu"); setError(""); }}>← 返回三种入口</button>
        {entry === "xiaohongshu" && <section className="recommendation-xhs-source"><label>小红书原帖 URL<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://www.xiaohongshu.com/…" /></label><button type="button" disabled={reading} onClick={() => void previewXhs()}>{reading ? "读取中…" : "读取公开信息"}</button><small>只读取公开 metadata，不使用 Cookie、不绕过登录或验证码。读取失败可手动补充。</small><div className="recommendation-kind-choice"><button type="button" className={xhsKind === "place" ? "active" : ""} onClick={() => setXhsKind("place")}>单个地点</button><button type="button" className={xhsKind === "guide" ? "active" : ""} onClick={() => setXhsKind("guide")}>一日游 / 主题攻略</button></div></section>}
        <label>标题<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={isGuide ? "例如：上海 Citywalk 一日游" : "例如：上海迪士尼"} /></label>
        <label>类型<select value={category} onChange={(event) => setCategory(event.target.value as Category)}><option value="attraction">景点</option><option value="food">美食</option><option value="shopping">购物</option><option value="other">其他</option></select></label>
        <label>简介 / 备注<textarea value={summary} maxLength={1000} onChange={(event) => setSummary(event.target.value)} placeholder="整理后的简短攻略，不复制整篇原文" /></label>
        {entry === "xiaohongshu" && <label>作者（读取不到时可手动填写）<input value={author} onChange={(event) => setAuthor(event.target.value)} /></label>}
        {entry !== "xiaohongshu" && <label>参考链接（可选）<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>}
        {isPlace && <section><b>确认真实地点</b><GenericPlacePicker slug={slug} existing={existingPlaces} value={place} onChange={setPlace} placeholder="搜索景点、餐厅、商店……" /></section>}
        {isGuide && <section className="recommendation-component-editor"><label>攻略形式<select value={guideType} onChange={(event) => setGuideType(event.target.value as "day_trip" | "theme")}><option value="day_trip">一日游攻略</option><option value="theme">主题攻略</option></select><small>一日游使用 guide_type=day_trip；美食、购物等主题攻略只使用上方类型。</small></label><label>建议时长（小时，可选）<input inputMode="decimal" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><b>攻略地点 · 建议顺序</b><GenericPlacePicker slug={slug} existing={existingPlaces} value={componentDraft} onChange={setComponentDraft} placeholder="搜索并确认攻略地点" /><button type="button" disabled={!componentDraft} onClick={addComponent}>加入攻略顺序</button>{components.map((component, index) => <div className="recommendation-component-row" key={`${component.source}-${component.id}`}><span><i>{String(index + 1).padStart(2, "0")}</i><b>{component.name}</b></span><div><button type="button" disabled={index === 0} onClick={() => moveComponent(index, -1)}>↑</button><button type="button" disabled={index === components.length - 1} onClick={() => moveComponent(index, 1)}>↓</button><button type="button" onClick={() => setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div></div>)}</section>}
        {entry === "xiaohongshu" && <label>参考截图（可选，最多 5 张）<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => setScreenshots(Array.from(event.target.files || []).slice(0, 5))} /><small>路线图、菜单、拍照机位或避坑截图；保留来源和水印，不进入旅行相册。</small></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="workspace-footer"><button type="button" className="button-secondary" disabled={saving} onClick={() => setOpen(false)}>取消</button><button type="button" className="button-primary" disabled={saving} onClick={() => void submit()}>{saving ? "保存中…" : "保存到素材库"}</button></footer>
      </div>}
    </WorkspaceOverlay>}
  </>;
}
