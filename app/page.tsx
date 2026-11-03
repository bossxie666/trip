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
  return <><link rel="preload" as="image" href="/assets/travel-desk/assets/book-closed-mobile.webp" media="(max-width:650px)" fetchPriority="high" /><link rel="preload" as="image" href="/assets/travel-desk/assets/book-closed-desktop.webp" media="(min-width:651px)" fetchPriority="high" /><link rel="preload" as="style" href="/assets/travel-desk/desk.css" /><SiteHeader active="home" currentMember={current} renderMobileNav={false}/><TravelDesk data={data}/><SiteMobileNav active="home" home/></>;
}
