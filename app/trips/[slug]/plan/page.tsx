import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPlanWorkspace } from "@/services/plan-workspace-service.server";
import { TripPlanWorkspace } from "@/components/trip/TripPlanWorkspace";
import { getCurrentMember } from "@/services/auth.server";

export const dynamic = "force-dynamic";
const views = new Set(["planning", "map", "budget"]), modes = new Set(["day", "library"]), areas = new Set(["shanghai", "hangzhou", "tonglu"]), categories = new Set(["all", "attraction", "food", "cafe", "shopping", "guide", "other"]);
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const workspace = await getPlanWorkspace((await params).slug); return workspace ? { title: `${workspace.trip.title} · 规划工作台`, description: "旅行攻略、正式行程、地图和预算工作台。", openGraph: { images: [] }, twitter: { images: [] } } : {}; }
export default async function TripPlanPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string; day?: string; mode?: string; q?: string; area?: string; category?: string }> }) {
  const { slug } = await params, query = await searchParams;
  const actor = await getCurrentMember();
  const workspace = await getPlanWorkspace(slug, actor?.id);
  if (!workspace) notFound();
  const view = views.has(query.view || "") ? query.view as "planning" | "map" | "budget" : "planning";
  const activeDayId = workspace.days.some((day) => day.id === query.day) ? query.day! : workspace.days[0]?.id || "";
  const mapMode = modes.has(query.mode || "") ? query.mode as "day" | "library" : "day";
  const areaFilter = areas.has(query.area || "") ? query.area as "shanghai" | "hangzhou" | "tonglu" : "shanghai";
  const categoryFilter = categories.has(query.category || "") ? query.category as "all" | "attraction" | "food" | "cafe" | "shopping" | "guide" | "other" : "all";
  return <TripPlanWorkspace workspace={workspace} activeDayId={activeDayId} view={view} mapMode={mapMode} query={(query.q || "").trim()} areaFilter={areaFilter} categoryFilter={categoryFilter}/>;
}
