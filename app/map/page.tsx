/* eslint-disable @next/next/no-html-link-for-pages */
import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";

export default async function MapPage() {
  const current = await getCurrentMember();
  return <main className="archive-placeholder"><div className="archive-placeholder-topbar"><MemberIdentityControl currentMember={current ? { id: current.id, displayName: current.displayName } : null} /></div><a href="/">返回首页</a><h1>旅行地图</h1><p>世界旅行足迹地图位置已预留。</p></main>;
}
