/* eslint-disable @next/next/no-html-link-for-pages */
import { cities } from "@/data/cities";
import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";

export default async function CitiesPage() {
  const current = await getCurrentMember();
  return <main className="archive-placeholder"><div className="archive-placeholder-topbar"><MemberIdentityControl currentMember={current ? { id: current.id, displayName: current.displayName } : null} /></div><a href="/">返回首页</a><h1>城市影集</h1><p>影集架构已预留。</p><ul>{cities.map((city) => <li key={city.id}><a href={`/cities/${city.slug}`}>{city.name}</a></li>)}</ul></main>;
}
