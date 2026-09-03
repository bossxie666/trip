import { NewTripForm } from "@/components/trip/NewTripForm";
import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";
import { listActiveMembers } from "@/services/member-repository.server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewTripPage() {
  const [current, members] = await Promise.all([getCurrentMember(), listActiveMembers()]);
  if (!current) redirect("/unlock");
  return <main className="new-trip-page"><nav className="archive-top-nav"><Link href="/trips">返回攻略中心</Link><MemberIdentityControl currentMember={{ id: current.id, displayName: current.displayName }} /></nav><header><span>NEW TRIP</span><h1>新建行程</h1><p>先保存最必要的信息，之后再慢慢补充。</p></header><NewTripForm members={members} currentMemberId={current.id} /></main>;
}
