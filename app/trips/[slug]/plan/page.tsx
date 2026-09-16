import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPlanWorkspace } from "@/services/plan-workspace-service.server";
import { findTripMetadataBySlug } from "@/services/trip-repository.server";
import { TripPlanWorkspace } from "@/components/trip/TripPlanWorkspace";
import { SiteHeader } from "@/components/site/SiteHeader";
import { createTripRequestContext } from "@/services/request-data-context.server";
import { getCurrentMember } from "@/services/auth.server";

export const dynamic = "force-dynamic";
const views = new Set(["planning", "map", "budget"]), modes = new Set(["day", "library"]), areas = new Set(["shanghai", "hangzhou", "tonglu"]), categories = new Set(["all", "core", "attraction", "food", "shopping", "day_trip", "other", "cafe", "guide"]), librarySorts = new Set(["core", "recent"]);
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const slug = (await params).slug; const actor = await getCurrentMember(); const trip = actor ? await findTripMetadataBySlug(slug, actor.id) : null; return trip ? { title: `${trip.title} · 规划工作台`, description: "旅行攻略、正式行程、地图和预算工作台。", openGraph: { images: [] }, twitter: { images: [] } } : {}; }
export default async function TripPlanPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string; day?: string; mode?: string; q?: string; area?: string; category?: string; library?: string; sort?: string; page?: string; member?: string; cost?: string }> }) {
  const { slug } = await params, query = await searchParams;
  const view = views.has(query.view || "") ? query.view as "planning" | "map" | "budget" : "planning";
  const areaFilter = areas.has(query.area || "") ? query.area as "shanghai" | "hangzhou" | "tonglu" : "shanghai";
  const categoryFilter = categories.has(query.category || "") ? query.category as "all" | "core" | "attraction" | "food" | "shopping" | "day_trip" | "other" | "cafe" | "guide" : "all";
  const librarySort = librarySorts.has(query.sort || "") ? query.sort as "core" | "recent" : "core";
  const parsedPage = Number.parseInt(query.page || "1", 10), libraryPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestContext = await createTripRequestContext(slug);
  if (!requestContext.permissions.canRead || !requestContext.actor) notFound();
  const actor = requestContext.actor;
  const workspace = await getPlanWorkspace(slug, actor?.id, { view, requestContext, recommendations: { area: areaFilter, category: categoryFilter, query: (query.q || "").trim(), library: query.library === "all", page: libraryPage, sort: librarySort } });
  if (!workspace) notFound();
  const activeDayId = workspace.days.some((day) => day.id === query.day) ? query.day! : workspace.days[0]?.id || "";
  const mapMode = modes.has(query.mode || "") ? query.mode as "day" | "library" : "day";
  // A signed-in member gets their own view by default.  The explicit `all`
  // query value is retained so the “全体” chip remains a real, selectable
  // state instead of being mistaken for an omitted parameter.
  const memberFilter = query.member === "all"
    ? "all"
    : query.member && (workspace.trip.members || []).some((member) => member.id === query.member)
      ? query.member
      : actor?.id && (workspace.trip.members || []).some((member) => member.id === actor.id)
        ? actor.id
        : "all";
  const costMode = query.cost === "actual" ? "actual" : "expected";
  return <><SiteHeader active="trips" currentMember={{ id: actor!.id, displayName: actor!.displayName, avatar: actor!.avatar }} /><TripPlanWorkspace workspace={workspace} activeDayId={activeDayId} view={view} mapMode={mapMode} query={(query.q || "").trim()} areaFilter={areaFilter} categoryFilter={categoryFilter} libraryMode={query.library === "all"} librarySort={librarySort} libraryPage={libraryPage} memberFilter={memberFilter} costMode={costMode} currentMember={{ id: actor!.id, displayName: actor!.displayName, avatar: actor!.avatar }}/></>;
}
