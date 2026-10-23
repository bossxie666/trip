/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { redirect } from "next/navigation";
import { Box, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCurrentMember } from "@/services/auth.server";
import { getMemberPersona } from "@/services/knowledge-service.server";
import "../knowledge/knowledge.css";
export const dynamic = "force-dynamic";
export default async function PersonaPage() { const actor = await getCurrentMember(); if (!actor) redirect("/unlock?returnTo=%2Fpersona"); const persona = await getMemberPersona(actor.id); return <><SiteHeader currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="persona-page"><a href="/knowledge">← 返回知识库</a><section className="persona-card"><header>{actor.avatar ? <img src={actor.avatar} alt="" /> : <i>{actor.displayName.slice(0, 1)}</i>}<div><small>MY CHARACTER</small><h1>{actor.displayName}</h1></div></header><div className="persona-stage">{persona && "modelUrl" in persona && persona.modelUrl ? <div className="persona-model-ready"><Box size={52} /><span>形象资源已连接</span></div> : <><Sparkles size={56} /><h2>3D形象准备中</h2><p>这里将展示你的Q版3D形象。</p></>}</div></section></main></>; }
