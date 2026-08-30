import Link from "next/link";
import { notFound } from "next/navigation";
import { cities, getCityBySlug } from "@/data/cities";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export default async function CityAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const city = getCityBySlug((await params).slug);
  if (!city) notFound();
  return <main className="archive-placeholder"><Link href="/cities">返回城市影集</Link><h1>{city.name}</h1><p>城市照片将在后续阶段加入。</p></main>;
}
