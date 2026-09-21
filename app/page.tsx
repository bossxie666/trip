import { redirect } from "next/navigation";
import "./reference-home.css";
import { ReferenceHome } from "@/components/home/ReferenceHome";
import { getCurrentMember } from "@/services/auth.server";
import { getHomeDashboard } from "@/services/home-dashboard.server";

export const dynamic = "force-dynamic";

export default async function TravelArchiveHome() {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2F");
  const dashboard = await getHomeDashboard(current.id);
  return <ReferenceHome current={current} dashboard={dashboard} />;
}
