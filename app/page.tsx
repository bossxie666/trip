/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Camera, MapPin, MessageSquareText, Plane, Route } from "lucide-react";
import { SiteHeader, SiteMobileNav } from "@/components/site/SiteHeader";
import { HomeAtlas } from "@/components/home/HomeAtlas";
import { HomePhotoRail } from "@/components/home/HomePhotoRail";
import { GuestbookBoard } from "@/components/home/GuestbookBoard";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { getHomeDashboard } from "@/services/home-dashboard.server";

function cover(value: string | null | undefined) { return value === "/og.png" ? "/og-card.jpg" : value || null; }
function range(start: string | null, end: string | null) { return start && end ? `${start.replaceAll("-", ".")} — ${end.slice(5).replaceAll("-", ".")}` : "日期未定"; }

export const dynamic = "force-dynamic";

export default async function TravelArchiveHome() {
  const current = await getCurrentMember();
  if (!current) redirect("/unlock?returnTo=%2F");
  const dashboard = await getHomeDashboard(current.id);
  const fallbackPhotos = dashboard.trips.map((trip) => cover(trip.cover)).filter((value): value is string => Boolean(value));
  const wallTrips = dashboard.trips.filter((trip) => cover(trip.cover));
  const wallPhotos = wallTrips.map((trip, index) => ({
    id: trip.id,
    src: cover(trip.cover)!,
    alt: trip.title,
    label: trip.cities[0]?.name || trip.title,
    frame: `/assets/homepage-v3/polaroid-frame-${index % 2 ? "02" : "01"}.webp`,
  }));
  const next = dashboard.upcoming;
  const nextCityNames = next ? (() => {
    const names = next.cities.map((city) => city.name);
    const preferred = ["上海", "杭州"].filter((name) => names.includes(name));
    return preferred.length === 2 ? preferred : names;
  })() : [];
  return <>
    <SiteHeader renderMobileNav={false} active="home" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} />
    <main className="home-journal mobile-home">
      <div className="home-decor-layer" aria-hidden="true">
        <img className="home-decor home-decor-botanical" src="/assets/homepage-v3/botanical-small.webp" alt="" />
        <img className="home-decor home-decor-plane" src="/assets/homepage-v3/sticker-paper-plane.webp" alt="" />
        <img className="home-decor home-decor-airmail" src="/assets/homepage-v3/sticker-airmail.webp" alt="" />
      </div>
      <section className="home-hero mobile-book-page">
        <article className="home-manifesto">
          <div className="home-eyebrow">旅行 · 收藏 · 探索</div>
          <h1 className="home-title-heading">
            <picture className="home-title-picture">
              <source media="(max-width: 767px)" srcSet="/assets/homepage-v3/title-mobile.png" />
              <img className="home-title-asset" src="/assets/homepage-v3/title-desktop.png" alt="跳进地理书的旅行" width={2172} height={724} />
            </picture>
          </h1>
          <p className="home-manifesto-line"><span>已点亮城市 <b>{dashboard.stats.cityCount}</b></span><span>已完成旅行 <b>{dashboard.stats.completed}</b></span><span>下一站 <b>{nextCityNames.join("·") || "等待决定"}</b></span></p>
          <div className="home-actions"><Link className="home-primary-action" href={next ? `/trips/${next.slug}/plan` : "/trips/new"}><Plane size={18} />规划下一段旅程<ArrowRight size={17} /></Link><Link className="home-secondary-action" href="/trips"><BookOpen size={18} />浏览旅行灵感</Link></div>
        </article>
        <HomeAtlas cities={dashboard.cities} photos={dashboard.featuredPhotos as { slotKey: "map_primary" | "map_secondary"; assetId: string }[]} fallbackPrimary={fallbackPhotos[0]} fallbackSecondary={fallbackPhotos[1]} />
        <article className="home-next-trip">
          <div className="next-trip-label"><span>下一站</span></div>
          {next ? <><h2>{nextCityNames.join(" · ") || next.title}</h2><time>{range(next.startDate, next.endDate)}</time>{cover(next.cover) ? <img src={cover(next.cover)!} alt={`${next.title}封面`} width={560} height={340} /> : <div className="next-trip-photo-empty">下一站，等一张照片</div>}<footer><span><MapPin size={16} />{nextCityNames.length || next.cities.length} 城市</span><span><Route size={16} />{next.days.length || "—"} 天</span><span>{next.members?.length || next.people} 人</span><Link href={`/trips/${next.slug}/plan`} aria-label={`打开${next.title}`}><ArrowRight size={19} /></Link></footer></> : <><h2>下一站待定</h2><p>先把想去的地方放进一条新行程。</p><Link className="home-primary-action" href="/trips/new">新建行程<ArrowRight size={17} /></Link></>}
        </article>
      </section>

      <div className="home-lower-band mobile-home-secondary">
        <section className="home-section home-photo-wall mobile-home-secondary" id="travel-wall">
          <header><div><Camera size={25} /><h2>旅行影像墙</h2></div><span>来自真实行程照片</span></header>
          <HomePhotoRail items={wallPhotos} />
        </section>

        <div className="home-lower-grid mobile-home-secondary">
          <section className="home-section home-guestbook">
            <header><div><MessageSquareText size={24} /><h2>留言板</h2></div><Link href="/messages">查看全部 →</Link></header>
            <GuestbookBoard compact initialMessages={dashboard.messages} currentMemberId={current.id} />
          </section>
        </div>
      </div>
    </main>
    <SiteMobileNav home active="home" />
  </>;
}
