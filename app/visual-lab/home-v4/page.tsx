import { notFound } from "next/navigation";
import { ReferenceHome } from "@/components/home/ReferenceHome";
import type { Trip } from "@/models/travel";

// Local-only visual fixture, based on content observed on the signed-in homepage.
const upcoming: Trip = { id: "preview-trip", slug: "gogogo-2026", title: "上海杭州gogogo", status: "planning", startDate: "2026-09-23", endDate: "2026-09-27", people: 5, cover: "/og-card.jpg", cities: [{ id: "shanghai", name: "上海", slug: "shanghai" }, { id: "hangzhou", name: "杭州", slug: "hangzhou" }], days: [], expenses: [], photos: [], createdAt: "", updatedAt: "" };

export default function VisualReferencePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReferenceHome current={{ id: "visual-preview", displayName: "预览" }} dashboard={{
    stats: { cityCount: 4, completed: 1, tripCount: 1 },
    trips: [upcoming], upcoming, cities: [
      { cityId: "shanghai", name: "上海", slug: "shanghai", centerLat: 31.23, centerLng: 121.47, tripStatus: "planning" },
      { cityId: "hangzhou", name: "杭州", slug: "hangzhou", centerLat: 30.27, centerLng: 120.15, tripStatus: "planning" },
      { cityId: "shenzhen", name: "深圳", slug: "shenzhen", centerLat: 22.54, centerLng: 114.06, tripStatus: "planning" },
      { cityId: "guilin", name: "桂林", slug: "guilin", centerLat: 25.27, centerLng: 110.29, tripStatus: "completed" },
    ], featuredPhotos: [], messages: [],
  }} />;
}
