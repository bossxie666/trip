import { redirect } from "next/navigation";
import { HomepageV4Live } from "@/components/home/HomepageV4Live";
import { getCurrentMember } from "@/services/auth.server";
import { getHomeDashboard } from "@/services/home-dashboard.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "跳进地理书的旅行", robots: { index: false, follow: false } };

export default async function HomeV4Page() {
  const member = await getCurrentMember();
  if (!member) redirect("/unlock?returnTo=%2Fhome-v4");
  // Preview reads must not backfill coordinates or write any production data.
  const dashboard = await getHomeDashboard(member.id, { resolveMissingCoordinates: false });
  return <HomepageV4Live dashboard={dashboard} member={{ id: member.id, displayName: member.displayName, avatar: member.avatar }} />;
}
