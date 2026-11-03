import { listActiveMembers } from "@/services/member-repository.server";
import { redirect } from "next/navigation";
import { GuestbookBoard } from "@/components/home/GuestbookBoard";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCurrentMember } from "@/services/auth.server";
import { listGuestbookMessages } from "@/services/guestbook-service.server";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2Fmessages");
  const [messages, members] = await Promise.all([listGuestbookMessages(current.id, 50), listActiveMembers()]);
  return <><SiteHeader active="messages" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar, role: current.role }} /><main className="journal-subpage compact-page guestbook-page"><GuestbookBoard members={members.map(m => ({ id: m.id, displayName: m.displayName }))} initialMessages={messages} currentMemberId={current.id} /></main></>;
}
