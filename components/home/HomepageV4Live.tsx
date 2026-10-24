/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- Use native document navigation at the Homepage/workspace boundary. */
import { ArrowRight, BookOpen, BriefcaseBusiness, Camera, Home, Image as ImageIcon, Map, MapPin, Menu, MessageCircle, Search } from "lucide-react";
import { MemberIdentityControl, type SessionMemberSummary } from "@/components/auth/MemberIdentityControl";
import { projectAtlasCities } from "@/services/atlas-cities";
import { wallPhotoSlots } from "@/services/home-media";
import type { getHomeDashboard } from "@/services/home-dashboard.server";
import { HomeCityMap } from "./HomeCityMap";
import { HomePhotoPicker } from "./HomePhotoPicker";
import styles from "@/app/visual-lab/home-v4/home-v4.module.css";

type Dashboard = Awaited<ReturnType<typeof getHomeDashboard>>;
const assets = "/assets/homepage-v3";
function image(value: string | null | undefined) { return value && value !== "/og.png" && value !== "/og-card.jpg" ? value : null; }
function dates(start: string | null, end: string | null) { return start ? `${start.replaceAll("-", ".")}${end ? ` — ${end.slice(5).replace("-", ".")}` : ""}` : "日期待定"; }

/** Real member data and functional links, sharing the approved visual canvas. */
export function HomepageV4Live({ dashboard, member, homeHref = "/home-v4" }: { dashboard: Dashboard; member: SessionMemberSummary; homeHref?: string }) {
  const next = dashboard.upcoming;
  const nextHref = next ? `/trips/${encodeURIComponent(next.slug)}/plan` : "/trips/new";
  const mapProps = { cities: dashboard.cities, trips: dashboard.cityTrips };
  const cities = projectAtlasCities(dashboard.cities);
  const wall = dashboard.featuredPhotos.filter((photo) => (wallPhotoSlots as readonly string[]).includes(photo.slotKey));
  const primary = dashboard.featuredPhotos.find((photo) => photo.slotKey === "map_primary");
  const secondary = dashboard.featuredPhotos.find((photo) => photo.slotKey === "map_secondary");
  const navigation = [{ href: homeHref, title: "首页", Icon: Home }, { href: "/trips", title: "我的旅行", Icon: BriefcaseBusiness }, { href: "/map", title: "地图", Icon: Map }, { href: "/albums", title: "相册", Icon: ImageIcon }, { href: "/messages", title: "留言", Icon: MessageCircle }];

  function atlasPhoto(slot: "map_primary" | "map_secondary", mobile = false) {
    const photo = slot === "map_primary" ? primary : secondary;
    return <div className={mobile ? styles.mobilePolaroid : slot === "map_primary" ? styles.desktopPolaroid : styles.desktopPolaroidSecondary}>
      {photo ? <img className={mobile ? styles.mobilePolaroidPhoto : styles.polaroidPhoto} src={`/api/media/${encodeURIComponent(photo.assetId)}?variant=card`} alt={slot === "map_primary" ? "地图主照片" : "地图副照片"} /> : <span className={styles.livePhotoEmpty}>选择旅行照片</span>}
      <img className={mobile ? styles.mobilePolaroidFrame : styles.polaroidFrame} src={`${assets}/polaroid-frame-01.webp`} alt="" aria-hidden="true" />
      <div className={styles.livePhotoEdit}><HomePhotoPicker slot={slot} selectedIds={photo ? [photo.assetId] : []} /></div>
    </div>;
  }
  function cityMarkers() {
    return <svg className={styles.liveCityMarkers} viewBox="0 0 100 100" aria-label={cities.length ? `旅行城市：${cities.map((city) => city.name).join("、")}` : "暂无已定位的旅行城市"}>
      {cities.map((city, index) => <g key={city.cityId} transform={`translate(${city.x} ${city.y})`}><circle r="1.5" fill="#1687ed" stroke="white" strokeWidth=".6" /><text x="2" y={index % 2 ? "4" : ".8"} fontSize="3" fill="#073b73">{city.name}</text></g>)}
    </svg>;
  }

  return <main className={`${styles.canvas} ${styles.liveCanvas}`} data-homepage="v4-live">
    <div className={styles.desktopComposition}>
      <img className={styles.desktopShell} src="/assets/homepage-v4/desktop-shell-v4.png" alt="" aria-hidden="true" />
      <header className={styles.desktopHeader}>
        <a className={styles.desktopBrand} href={homeHref}><span>Trip.Bossxie</span><small>把世界，装进行程里。</small></a>
        <nav className={styles.desktopNav} aria-label="网站主导航">{navigation.map(({ href, title, Icon }, index) => <a href={href} key={href} className={index === 0 ? styles.navActive : ""} aria-current={index === 0 ? "page" : undefined}><Icon size={18} />{title}</a>)}</nav>
        <div className={styles.desktopAccount}><form className={styles.searchPill} action="/search"><Search size={16} /><input name="q" aria-label="搜索旅行内容" placeholder="搜索目的地、国家或旅行笔记…" /></form><MemberIdentityControl compact currentMember={member} /></div>
      </header>
      <section className={styles.desktopHero} aria-label="旅行手帐">
        <article className={styles.desktopManifesto}>
          <h1 className={styles.liveTitleHeading}><img className={styles.desktopTitle} src={`${assets}/title-mobile.webp`} alt="跳进地理书的旅行" width={1448} height={1086} /></h1>
          <div className={styles.desktopStats}><span>已点亮城市 <b>{dashboard.stats.cityCount}</b></span><span>已完成旅行 <b>{dashboard.stats.completed}</b></span></div>
          <div className={styles.desktopActions}><a className={styles.primaryAction} href={nextHref}>规划下一段旅程<ArrowRight size={16} /></a><a className={styles.secondaryAction} href="/trips"><BookOpen size={17} />我的旅行</a></div>
        </article>
        <article className={styles.desktopAtlas} aria-label="旅行城市概览">
          <span className={styles.atlasNote}>在地图上，<br />遇见更大的自己。</span>
          {cityMarkers()}
          {atlasPhoto("map_primary")}{atlasPhoto("map_secondary")}
          <div className={styles.liveMapEntry}><HomeCityMap {...mapProps} /></div>
        </article>
        <article className={styles.desktopNextTrip}>
          <img className={styles.nextSticker} src={`${assets}/sticker-next-trip.webp`} alt="下一站" />
          <h2 title={next?.title}>{next ? next.cities.map((city) => city.name).join(" · ") || next.title : "下一站待定"}</h2>
          <time>{next ? dates(next.startDate, next.endDate) : ""}</time>
          <a className={styles.nextPhoto} href={nextHref} aria-label={next ? `打开${next.title}` : "新建行程"}>{next && image(next.cover) ? <img src={image(next.cover)!} alt={`${next.title}封面`} /> : <span className={styles.livePhotoEmpty}>{next ? "尚未选择封面" : "新建一条旅行"}</span>}</a>
          <div className={styles.nextMeta}><span><MapPin size={15} />{next?.cities.length || 0} 城市</span>{next && <><span>{next.startDate && next.endDate ? Math.max(1, Math.round((Date.parse(next.endDate) - Date.parse(next.startDate)) / 86400000) + 1) : "—"} 天</span><span>{next.members?.length || next.people} 人</span></>}<a href={nextHref} aria-label={next ? `规划${next.title}` : "新建行程"}><ArrowRight size={18} /></a></div>
        </article>
        <img className={styles.desktopCamera} src="/assets/homepage-v4/camera-v4.png" alt="" aria-hidden="true" />
      </section>
      <section className={styles.desktopLower} aria-label="旅行影像和记录">
        <div className={styles.galleryHeading}><span className={styles.sectionIcon}><Camera size={23} /></span><h2>旅行影像墙</h2><a className={styles.sectionLink} href="/albums">查看相册 →</a></div>
        <div className={`${styles.galleryRail} ${styles.liveGalleryRail}`}>
          {wall.map((photo, index) => <figure className={`${styles.galleryCard} ${styles[`galleryTilt${index % 4}`]}`} key={photo.slotKey}><a href={`/api/media/${encodeURIComponent(photo.assetId)}?variant=display`} target="_blank" rel="noreferrer" aria-label="打开旅行精选照片"><div className={styles.galleryFrame}><img className={styles.liveWallPhoto} src={`/api/media/${encodeURIComponent(photo.assetId)}?variant=card`} alt="精选旅行照片" /><img className={styles.liveWallFrame} src={`/assets/homepage-v4/polaroid-landscape-${index % 2 ? "02" : "01"}.png`} alt="" aria-hidden="true" /></div></a></figure>)}
          <div className={styles.liveWallPicker}><HomePhotoPicker slot="wall" selectedIds={wall.map((photo) => photo.assetId)} /></div>
          {!wall.length && <a className={styles.liveEmptyLink} href="/albums">从相册选择旅行照片</a>}
        </div>
        <section className={styles.myTripsPreview} aria-label="我的旅行">
          <div className={styles.myTripsHeading}><span className={styles.sectionIcon}><BriefcaseBusiness size={23} /></span><h2>我的旅行</h2><a className={styles.sectionLink} href="/trips">查看全部 →</a></div>
          <div className={styles.myTripsCards}>{dashboard.trips.map((trip) => <a className={styles.myTripCard} href={`/trips/${encodeURIComponent(trip.slug)}/plan`} key={trip.id}>
            {image(trip.cover) ? <img src={image(trip.cover)!} alt={`${trip.title}封面`} /> : <div className={styles.liveTripCoverEmpty}><BriefcaseBusiness size={28} /></div>}
            <strong title={trip.title}>{trip.title}</strong><small className={styles.liveTripDate}>{dates(trip.startDate, trip.endDate)}</small><span className={styles.tripCardArrow} aria-hidden="true"><ArrowRight size={14} /></span>
          </a>)}{!dashboard.trips.length && <a className={styles.liveEmptyLink} href="/trips/new">＋ 新建行程</a>}</div>
        </section>
        <div className={styles.guestbookHeading}><span className={styles.sectionIcon}><MessageCircle size={23} /></span><h2>留言板</h2><a className={styles.sectionLink} href="/messages">写下留言 →</a></div>
        <div className={styles.guestbookNotes}>{dashboard.messages.map((message, index) => <a href="/messages" className={`${styles.noteCard} ${styles.liveNoteCard} ${styles[`noteTilt${index % 3}`]}`} key={message.id}><span className={styles.noteDot} /><strong>{message.author.displayName}</strong><time>{message.createdAt.slice(0, 10).replaceAll("-", ".")}</time><p>{message.body || "分享了旅行照片"}</p></a>)}{!dashboard.messages.length && <a href="/messages" className={styles.liveEmptyLink}>写下第一条留言 →</a>}</div>
      </section>
    </div>
    <div className={styles.mobileComposition}>
      <img className={styles.mobileShell} src={`${assets}/mobile-shell.webp`} alt="" aria-hidden="true" />
      <header className={styles.mobileTopbar}><div className={styles.mobileTools}><span className={styles.menuIcon} aria-hidden="true"><Menu size={20} /></span><span className={styles.mobileDivider} /><a href="/search" aria-label="搜索旅行内容"><Search size={20} /></a></div><MemberIdentityControl compact currentMember={member} /></header>
      <section className={styles.mobileBookContent} aria-label="旅行手帐">
        <span className={styles.mobileNote}>在地图上，<br />遇见更大的自己。</span>
        <img className={styles.mobileTitle} src={`${assets}/title-mobile.webp`} alt="跳进地理书的旅行" width={1448} height={1086} />
        <div className={styles.mobileStats}><span>已点亮城市 <b>{dashboard.stats.cityCount}</b></span><i /><span>已完成旅行 <b>{dashboard.stats.completed}</b></span></div>
        <div className={styles.mobileAtlasFrame}><img className={styles.mobileAtlasImage} src={`${assets}/atlas-mobile.webp`} alt="" aria-hidden="true" />{cityMarkers()}{atlasPhoto("map_primary", true)}</div>
        <img className={styles.mobileStamp} src={`${assets}/sticker-airmail.webp`} alt="" aria-hidden="true" /><img className={styles.mobileCompass} src={`${assets}/sticker-compass.webp`} alt="" aria-hidden="true" />
        <div className={styles.liveMobileMapEntry}><HomeCityMap {...mapProps} /></div>
      </section>
      <nav className={styles.mobileBottomNav} aria-label="移动端主导航">{navigation.filter((item) => item.href !== "/map").map(({ href, title, Icon }, index) => <a key={href} href={href} className={index === 0 ? styles.bottomActive : ""} aria-current={index === 0 ? "page" : undefined}><Icon size={22} /><b>{title}</b></a>)}</nav>
    </div>
  </main>;
}
