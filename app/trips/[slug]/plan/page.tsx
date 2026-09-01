import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPlanWorkspace } from "@/services/plan-workspace-service.server";
import { TripPlanWorkspace } from "@/components/trip/TripPlanWorkspace";

export const dynamic = "force-dynamic";
const views = new Set(["planning", "map", "budget"]), modes = new Set(["day", "library"]);
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const workspace = await getPlanWorkspace((await params).slug); return workspace ? { title: `${workspace.trip.title} · 规划工作台`, description: "旅行攻略、正式行程、地图和预算工作台。", openGraph: { images: [] }, twitter: { images: [] } } : {}; }
export default async function TripPlanPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string; day?: string; mode?: string; q?: string }> }) {
  const { slug } = await params, query = await searchParams;
  const workspace = await getPlanWorkspace(slug);
  if (!workspace) notFound();
  const view = views.has(query.view || "") ? query.view as "planning" | "map" | "budget" : "planning";
  const activeDayId = workspace.days.some((day) => day.id === query.day) ? query.day! : workspace.days[0]?.id || "";
  const mapMode = modes.has(query.mode || "") ? query.mode as "day" | "library" : "day";
  return <TripPlanWorkspace workspace={workspace} activeDayId={activeDayId} view={view} mapMode={mapMode} query={(query.q || "").trim()}/>;
}
