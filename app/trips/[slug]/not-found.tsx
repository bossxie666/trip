import { SiteHeader } from "@/components/site/SiteHeader";
import { getCurrentMember } from "@/services/auth.server";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";

export default async function TripNotFound() {
  const current = await getCurrentMember();
  return <><SiteHeader active="trips" currentMember={current ? { id: current.id, displayName: current.displayName, avatar: current.avatar, role: current.role } : null} /><main className="system-state-page"><section className="system-state-card"><h1>没有找到这条行程</h1><div><Link href="/trips">我的旅行</Link><Link href="/">返回首页</Link></div></section></main></>;
}
