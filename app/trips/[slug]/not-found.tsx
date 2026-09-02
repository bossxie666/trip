/* eslint-disable @next/next/no-html-link-for-pages */
import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";

export default async function TripNotFound() {
  const current = await getCurrentMember();
  return <main className="archive-placeholder"><div className="archive-placeholder-topbar"><MemberIdentityControl currentMember={current ? { id: current.id, displayName: current.displayName } : null} /></div><a href="/trips">返回攻略中心</a><h1>没有找到这条行程</h1><p>它可能尚未创建、地址有误，或者已经被移除。</p></main>;
}
