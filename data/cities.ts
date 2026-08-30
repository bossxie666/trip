import type { City } from "@/models/travel";

export const cities: City[] = [
  { id: "shanghai", slug: "shanghai", name: "上海", country: "中国" },
  { id: "hangzhou", slug: "hangzhou", name: "杭州", country: "中国" },
];

export function getCityBySlug(slug: string) {
  return cities.find((city) => city.slug === slug);
}
