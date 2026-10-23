import { NewTripForm } from "@/components/trip/NewTripForm";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCurrentMember } from "@/services/auth.server";
import { listActiveMembers } from "@/services/member-repository.server";
import { redirect } from "next/navigation";

export default async function NewTripPage() {
  const [current, members] = await Promise.all([getCurrentMember(), listActiveMembers()]);
  if (!current) redirect("/unlock");
  return <><SiteHeader active="trips" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} /><main className="new-trip-page"><header><h1>新建行程</h1></header><NewTripForm members={members} currentMemberId={current.id} /></main></>;
}
