import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";

export default async function TripNotFound() {
  const current = await getCurrentMember();
  return <main className="archive-placeholder"><div className="archive-placeholder-topbar"><MemberIdentityControl currentMember={current ? { id: current.id, displayName: current.displayName } : null} /></div><Link href="/trips">返回攻略中心</Link><h1>没有找到这条行程</h1><p>它可能尚未创建、地址有误，或者已经被移除。</p></main>;
}
