import { redirect } from "next/navigation";
import { TravelDesk } from "@/components/home/TravelDesk";
import { SiteHeader, SiteMobileNav } from "@/components/site/SiteHeader";
import { getCurrentMember } from "@/services/auth.server";
import { getHomeDesk } from "@/services/home-desk.server";

export const dynamic = "force-dynamic";

export default async function TravelArchiveHome() {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2F");
  const data = await getHomeDesk(current.id);
  return <><SiteHeader active="home" currentMember={current} renderMobileNav={false}/><TravelDesk data={data}/><SiteMobileNav active="home" home/></>;
}
