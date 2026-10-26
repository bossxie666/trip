/* eslint-disable @next/next/no-img-element */
import { notFound, redirect } from "next/navigation";
import { ExternalLink, Heart } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { getKnowledgeEntry } from "@/services/knowledge-service.server";
import { getLegacyKnowledgeDetails } from "@/services/knowledge-legacy.server";
import "../knowledge.css";
const labels = { photography: "拍照知识", transition_video: "转场视频", travel_guide: "旅游攻略" };
const categories: Record<string, string> = { attraction: "景点", food: "美食", cafe: "咖啡", shopping: "购物", hotel: "住宿", experience: "体验", other: "其他" };
const bases: Record<string, string> = { per_person: "每人", per_group: "每组", per_item: "每项" };
function money(minor: number, currency: string) { try { return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(minor / 100); } catch { return `${(minor / 100).toFixed(2)} ${currency}`; } }
export const dynamic = "force-dynamic";
export default async function KnowledgeDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) redirect("/unlock");
  const entry = await getKnowledgeEntry(actor.id, (await params).id); if (!entry) notFound();
  const legacy = await getLegacyKnowledgeDetails(entry.legacyRecommendationId);
  const images = [...new Set([...entry.mediaAssetIds.map(id => `/api/media/${id}?variant=display`), ...(entry.coverImageUrl ? [entry.coverImageUrl] : []), ...(legacy?.references.flatMap(reference => reference.images) || [])])];
  const sources = [...(entry.externalUrl ? [{ id: "primary", title: entry.sourceLabel || "来源", url: entry.externalUrl, authorLabel: null, note: null }] : []), ...(legacy?.references || [])];
  const distinctSources = [...new Map(sources.map(source => [source.url || source.id, source])).values()];
  const price = legacy?.priceBasis === "free" ? "免费" : legacy?.priceMinMinor !== null && legacy?.priceMinMinor !== undefined ? `${money(legacy.priceMinMinor, legacy.priceCurrency)}${legacy.priceMaxMinor !== null && legacy.priceMaxMinor !== legacy.priceMinMinor ? `–${money(legacy.priceMaxMinor, legacy.priceCurrency)}` : ""}${legacy.priceBasis && bases[legacy.priceBasis] ? ` / ${bases[legacy.priceBasis]}` : ""}` : null;
  return <><SiteHeader currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="knowledge-detail"><Link href="/knowledge">← 返回知识库</Link><article>
    <header><small>{labels[entry.section]}</small><h1>{entry.title}</h1><div>{entry.destination && <span>{entry.destination}</span>}{entry.tags.map(tag => <span key={tag}>#{tag}</span>)}{entry.favorite && <span><Heart size={14} fill="currentColor" /> 已收藏</span>}</div></header>
    {legacy && <dl className="knowledge-facts"><div><dt>分类</dt><dd>{categories[legacy.category] || "其他"}</dd></div>{price && <div><dt>参考价格</dt><dd>{price}</dd></div>}{legacy.durationMinutes && <div><dt>预计时长</dt><dd>{legacy.durationMinutes} 分钟</dd></div>}</dl>}
    {images.length > 0 && <div className={`knowledge-detail-gallery${images.length === 1 ? " single" : ""}`}>{images.map((src, index) => <img src={src} alt={`${entry.title} 图片 ${index + 1}`} key={src} loading="lazy" />)}</div>}
    {entry.summary && <p className="knowledge-lead">{entry.summary}</p>}
    <div className="knowledge-body">{(entry.body === entry.summary ? "" : entry.body || "").split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</div>
    {entry.places.length > 0 && <section className="knowledge-detail-places"><h2>关联地点</h2><ul>{entry.places.map(place => <li key={place.id}><strong>{place.name}</strong>{place.address && <span>{place.address}</span>}</li>)}</ul></section>}
    {distinctSources.length > 0 && <section className="knowledge-sources"><h2>参考来源</h2>{distinctSources.map(source => <div key={source.id}>{source.url && <a className="knowledge-source" href={source.url} target="_blank" rel="noopener noreferrer">{source.title || "来源"} <ExternalLink size={16} /></a>}{source.authorLabel && <small>{source.authorLabel}</small>}{source.note && <p>{source.note}</p>}</div>)}</section>}
    <footer>由 {entry.authorName || "旅行成员"} 整理 · {new Date(entry.updatedAt).toLocaleDateString("zh-CN")}</footer>
  </article></main></>;
}