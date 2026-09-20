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
  return <><SiteHeader currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} /><main className="journal-subpage search-page"><header><h1>搜索</h1><form><Search size={18} /><input name="q" defaultValue={query} placeholder="搜索行程、城市、攻略或地点" /><button>搜索</button></form></header>{query.length < 2 ? <p className="search-empty">请输入至少两个字。</p> : <section className="search-results"><p>{results.length} 条结果</p>{results.map((result) => <Link href={result.href} key={`${result.type}:${result.id}`}><span>{labels[result.type]}</span><h2>{result.title}</h2><p>{result.subtitle}</p></Link>)}{!results.length && <div className="search-empty">没有匹配内容</div>}</section>}</main></>;
}
