"use client";
/* eslint-disable @next/next/no-img-element -- remote reference captures use lazy, fixed-size fallbacks and are not trusted image-loader inputs */
import { useState } from "react";
import { WorkspaceOverlay } from "./WorkspaceOverlay";
import { FieldLabel, RouteSketch, TapeAccent } from "./TravelJournalPrimitives";
import { RecommendationCover } from "./RecommendationCover";

type Detail = { recommendation: { title: string; summary: string | null; kind: "place" | "guide"; category: string | null; areaLabel: string | null; guideType: string | null; estimatedDurationMinutes: number | null; coverImageUrl: string | null; sourceLabel: string | null; sourceUrl: string | null }; options: { option: { id: string; note: string | null }; place: { id: string; name: string; address: string | null } }[]; references: { id: string; platform: string; authorLabel: string | null; title: string | null; sourceUrl: string; imageUrls: string[]; note: string | null }[] };

export function RecommendationDetailControl({ slug, recommendationId }: { slug: string; recommendationId: string }) {
  const [open, setOpen] = useState(false), [detail, setDetail] = useState<Detail | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function show() {
    setOpen(true);
    if (detail || loading) return;
    setLoading(true); setError("");
    try { const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/recommendations/${encodeURIComponent(recommendationId)}`); const payload = await response.json() as Detail & { error?: string }; if (!response.ok) throw new Error(payload.error || "详情加载失败"); setDetail(payload); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "详情加载失败"); }
    finally { setLoading(false); }
  }
  return <><button type="button" className="recommendation-detail-trigger" onClick={show}>查看详情</button><WorkspaceOverlay open={open} onClose={() => setOpen(false)} mode="drawer" ariaLabel="攻略素材详情" className="recommendation-detail-drawer">
    <header><div><span>{detail?.recommendation.kind === "guide" ? "GUIDE" : "PLACE"}</span><h2>{detail?.recommendation.title || "攻略详情"}</h2></div><button type="button" className="workspace-close" onClick={() => setOpen(false)} aria-label="关闭">×</button></header>
    <div className={`recommendation-detail-body recommendation-detail-${detail?.recommendation.kind || "loading"}`}>{loading && <p>加载中…</p>}{error && <p role="alert" className="form-error">{error}</p>}{detail && <><section className="recommendation-detail-hero"><TapeAccent tone={detail.recommendation.kind === "guide" ? "green" : "blue"} /><div className="recommendation-detail-visual"><RecommendationCover src={detail.recommendation.coverImageUrl} label={detail.recommendation.kind === "guide" ? "GUIDE" : detail.recommendation.areaLabel || "PLACE"} kind={detail.recommendation.kind} category={detail.recommendation.category} eager /></div><div className="recommendation-detail-intro"><FieldLabel>{detail.recommendation.kind === "guide" ? "FIELD ROUTE" : "PLACE RECORD"}</FieldLabel><h2>{detail.recommendation.title}</h2><p>{[detail.recommendation.areaLabel, detail.recommendation.kind === "guide" ? "路线攻略" : "真实地点", detail.recommendation.estimatedDurationMinutes ? `约 ${Math.round(detail.recommendation.estimatedDurationMinutes / 60 * 10) / 10} 小时` : null].filter(Boolean).join(" · ")}</p>{detail.recommendation.kind === "guide" && <RouteSketch count={Math.min(4, Math.max(2, detail.options.length))} />}</div></section>
      {detail.recommendation.summary && <p className="recommendation-detail-summary">{detail.recommendation.summary}</p>}
      <h3>{detail.recommendation.kind === "guide" ? "行程组成" : "关联地点"}</h3><ol>{detail.options.map(({ option, place }) => <li key={option.id}><b>{place.name}</b>{place.address && <span>{place.address}</span>}{option.note && <small>{option.note}</small>}</li>)}</ol>
      {(detail.recommendation.sourceUrl || detail.references.length > 0) && <><h3>参考来源</h3><ul>{detail.recommendation.sourceUrl && <li><a href={detail.recommendation.sourceUrl} target="_blank" rel="noreferrer">{detail.recommendation.sourceLabel || "原始来源"}</a></li>}{detail.references.map((reference) => <li key={reference.id}><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.title || reference.authorLabel || reference.platform}</a>{reference.note && <small>{reference.note}</small>}{reference.imageUrls.map((url) => <img key={url} src={url} alt="" loading="lazy" width="480" height="320" />)}</li>)}</ul></>}
    </>}</div>
  </WorkspaceOverlay></>;
}
