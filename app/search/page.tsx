import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { searchMemberWorkspace } from "@/services/global-search.server";

const labels = { trip: "行程", city: "目的地", recommendation: "攻略素材", place: "地点" };

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2Fsearch");
  const query = (await searchParams).q?.trim() || "";
  const results = await searchMemberWorkspace(current.id, query);
  return <><SiteHeader currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} /><main className="journal-subpage search-page"><header><span>SEARCH THE JOURNAL</span><h1>搜索旅行手帐</h1><form><Search size={18} /><input name="q" defaultValue={query} placeholder="搜索行程、城市、攻略或地点" /><button>搜索</button></form></header>{query.length < 2 ? <p className="search-empty">输入至少两个字开始搜索。</p> : <section className="search-results"><p>“{query}”找到 {results.length} 条结果</p>{results.map((result) => <Link href={result.href} key={`${result.type}:${result.id}`}><span>{labels[result.type]}</span><h2>{result.title}</h2><p>{result.subtitle}</p></Link>)}{!results.length && <div className="search-empty">没有找到匹配内容，可以换一个更短的关键词。</div>}</section>}</main></>;
}
