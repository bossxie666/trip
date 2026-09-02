/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { cities, getCityBySlug } from "@/data/cities";
import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export default async function CityAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const city = getCityBySlug((await params).slug);
  if (!city) notFound();
  const current = await getCurrentMember();
  return <main className="archive-placeholder"><div className="archive-placeholder-topbar"><MemberIdentityControl currentMember={current ? { id: current.id, displayName: current.displayName } : null} /></div><a href="/cities">返回城市影集</a><h1>{city.name}</h1><p>城市照片将在后续阶段加入。</p></main>;
}
