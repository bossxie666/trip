import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { KnowledgeLibraryClient } from "@/components/knowledge/KnowledgeLibraryClient";
import { getCurrentMember } from "@/services/auth.server";
import { listKnowledgePage, listKnowledgeTags } from "@/services/knowledge-service.server";
import type { KnowledgeQuery } from "@/services/knowledge-navigation";
import "./knowledge.css";
export const dynamic = "force-dynamic";
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<KnowledgeQuery> }) {
  const actor = await getCurrentMember();
  if (!actor) redirect("/unlock?returnTo=%2Fknowledge");
  const query = await searchParams;
  const [result, tags] = await Promise.all([listKnowledgePage(actor.id, { ...query, page: Number(query.page || 1), favorite: query.favorite === "1" }), listKnowledgeTags()]);
  return <><SiteHeader currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="knowledge-page">
    <header className="knowledge-page-heading"><h1>知识库</h1><form>
      {(["section", "tag", "favorite"] as const).map((key) => query[key] ? <input key={key} type="hidden" name={key} value={query[key]} /> : null)}
      <input name="q" aria-label="搜索知识" defaultValue={query.q || ""} placeholder="搜索知识或标签" />
      <input name="destination" aria-label="目的地筛选" defaultValue={query.destination || ""} placeholder="目的地" />
      <button>搜索</button></form></header>
    <KnowledgeLibraryClient entries={result.entries} initialSection={query.section || ""} favoriteOnly={query.favorite === "1"} query={query} tags={tags.map((tag) => tag.name)} page={result.page} hasMore={result.hasMore} />
  </main></>;
}
