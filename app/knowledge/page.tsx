import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { KnowledgeLibraryClient } from "@/components/knowledge/KnowledgeLibraryClient";
import { getCurrentMember } from "@/services/auth.server";
import { listKnowledge } from "@/services/knowledge-service.server";
import "./knowledge.css";
export const dynamic = "force-dynamic";
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ section?: string; q?: string; tag?: string; destination?: string; favorite?: string }> }) { const actor = await getCurrentMember(); if (!actor) redirect("/unlock?returnTo=%2Fknowledge"); const query = await searchParams, entries = await listKnowledge(actor.id, { ...query, favorite: query.favorite === "1" }); return <><SiteHeader currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="knowledge-page"><header className="knowledge-page-heading"><small>KNOWLEDGE</small><h1>知识库</h1><form><input name="q" defaultValue={query.q || ""} placeholder="搜索知识、目的地或标签" /><button>搜索</button></form></header><KnowledgeLibraryClient entries={entries} initialSection={query.section || ""} favoriteOnly={query.favorite === "1"} /></main></>; }
