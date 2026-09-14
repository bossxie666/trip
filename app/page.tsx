/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Camera, MapPin, MessageSquareText, Plane, Route } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { HomeAtlas } from "@/components/home/HomeAtlas";
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
  const next = dashboard.upcoming;
  return <>
    <SiteHeader active="home" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} />
    <main className="home-journal">
      <div className="home-decor-layer" aria-hidden="true">
        <img className="home-floating-foliage home-floating-foliage-top" src="/assets/scrapbook-foliage.webp" alt="" />
        <img className="home-floating-camera" src="/assets/scrapbook-camera.webp" alt="" />
        <img className="home-floating-foliage home-floating-foliage-lower" src="/assets/scrapbook-foliage.webp" alt="" loading="lazy" />
      </div>
      <section className="home-hero">
        <article className="home-manifesto">
          <div className="home-eyebrow">TRAVEL · COLLECT · EXPLORE</div>
          <h1 className="home-title-heading">
            <img className="home-title-asset" src="/assets/travel-title.png" alt="跳进地理书的旅行" width={2172} height={724} />
          </h1>
          <p className="home-manifesto-line"><span>已点亮城市 <b>{dashboard.stats.cityCount}</b></span><span>已完成旅行 <b>{dashboard.stats.completed}</b></span><span>下一站 <b>{next?.cities.map((city) => city.name).join("·") || "等待决定"}</b></span></p>
          <div className="home-actions"><Link className="home-primary-action" href={next ? `/trips/${next.slug}/plan` : "/trips/new"}><Plane size={18} />规划下一段旅程<ArrowRight size={17} /></Link><Link className="home-secondary-action" href="/trips"><BookOpen size={18} />浏览旅行灵感</Link></div>
          <small>Same places, different stories.</small>
        </article>
        <HomeAtlas points={dashboard.points} photos={dashboard.featuredPhotos as { slotKey: "map_primary" | "map_secondary"; assetId: string }[]} fallbackPrimary={fallbackPhotos[0]} fallbackSecondary={fallbackPhotos[1]} />
        <article className="home-next-trip">
          <div className="next-trip-label"><span>下一站</span><small>NEXT TRIP</small></div>
          {next ? <><h2>{next.cities.map((city) => city.name).join(" · ") || next.title}</h2><time>{range(next.startDate, next.endDate)}</time>{cover(next.cover) ? <img src={cover(next.cover)!} alt={`${next.title}封面`} width={560} height={340} /> : <div className="next-trip-photo-empty">下一站，等一张照片</div>}<footer><span><MapPin size={16} />{next.cities.length} 城市</span><span><Route size={16} />{next.days.length || "—"} 天</span><span>{next.members?.length || next.people} 人</span><Link href={`/trips/${next.slug}/plan`} aria-label={`打开${next.title}`}><ArrowRight size={19} /></Link></footer></> : <><h2>下一站待定</h2><p>先把想去的地方放进一条新行程。</p><Link className="home-primary-action" href="/trips/new">新建行程<ArrowRight size={17} /></Link></>}
        </article>
      </section>

      <section className="home-section home-photo-wall mobile-home-secondary" id="travel-wall">
        <header><div><Camera size={25} /><h2>旅行影像墙</h2><p>那些走过的地方，都变成了特别的回忆。</p></div><span>来自真实行程封面</span></header>
        <div className="home-photo-strip">{dashboard.trips.filter((trip) => cover(trip.cover)).map((trip, index) => <figure key={trip.id} className={`home-photo-card home-photo-card-${index % 4}`}><img src={cover(trip.cover)!} alt={trip.title} width={520} height={380} loading={index < 3 ? "eager" : "lazy"} /><figcaption><b>{trip.cities[0]?.name || trip.title}</b><span>{trip.startDate?.slice(0, 7).replace("-", ".") || "DATE TBD"}</span></figcaption></figure>)}{!dashboard.trips.some((trip) => cover(trip.cover)) && <div className="home-photo-wall-empty">为行程添加封面后，影像会在这里排成一面旅行墙。</div>}</div>
      </section>

      <div className="home-lower-grid mobile-home-secondary">
        <section className="home-section home-trips" id="profile">
          <header><div><BookOpen size={24} /><h2>我的旅行</h2><p>记录走过的路，也记录当时的自己。</p></div><Link href="/trips">查看全部 →</Link></header>
          <div>{dashboard.trips.map((trip) => <Link className="home-trip-card" href={`/trips/${trip.slug}/plan`} key={trip.id}>{cover(trip.cover) ? <img src={cover(trip.cover)!} alt="" width={440} height={250} loading="lazy" /> : <div className="home-trip-cover-empty">NO COVER</div>}<span>{trip.status === "completed" ? "已完成" : trip.status === "planning" ? "待出发" : "灵感"}</span><h3>{trip.title}</h3><small>{range(trip.startDate, trip.endDate)} · {trip.members?.length || trip.people} 人</small></Link>)}</div>
        </section>
        <section className="home-section home-guestbook">
          <header><div><MessageSquareText size={24} /><h2>留言板</h2><p>在这里，留下你来过的痕迹。</p></div><Link href="/messages">查看全部 →</Link></header>
          <GuestbookBoard compact initialMessages={dashboard.messages} currentMemberId={current.id} />
        </section>
      </div>
    </main>
  </>;
}
