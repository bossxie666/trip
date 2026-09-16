import { redirect } from "next/navigation";
import { GuestbookBoard } from "@/components/home/GuestbookBoard";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCurrentMember } from "@/services/auth.server";
import { listGuestbookMessages } from "@/services/guestbook-service.server";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2Fmessages");
  const messages = await listGuestbookMessages(50);
  return <><SiteHeader active="messages" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} /><main className="journal-subpage compact-page guestbook-page"><GuestbookBoard initialMessages={messages} currentMemberId={current.id} /></main></>;
}
