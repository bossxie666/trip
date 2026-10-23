/* eslint-disable @next/next/no-img-element */
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Home,
  Image as ImageIcon,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Search,
} from "lucide-react";
import styles from "./home-v4.module.css";

const ASSET = "/assets/homepage-v3";
const V4_ASSET = "/assets/homepage-v4";

const galleryPlaceholders = [
  { label: "城市影像", position: "left center" },
  { label: "山水之间", position: "center center" },
  { label: "沿途片段", position: "right center" },
  { label: "慢行记录", position: "center top" },
  { label: "远方来信", position: "left bottom" },
  { label: "下一页", position: "right bottom" },
  { label: "好风景", position: "center center" },
  { label: "旅途光影", position: "right center" },
  { label: "下一站", position: "left center" },
];

function Marker({ className, name }: { className: string; name: string }) {
  return (
    <span className={`${styles.marker} ${className}`}>
      <i aria-hidden="true" />
      <b>{name}</b>
    </span>
  );
}

function GalleryPlaceholder({
  label,
  position,
  index,
}: {
  label: string;
  position: string;
  index: number;
}) {
  return (
    <figure className={`${styles.galleryCard} ${styles[`galleryTilt${index % 4}`]}`}>
      <div className={styles.galleryFrame}>
        <div
          className={styles.galleryPhoto}
          style={{
            backgroundImage: "url(/og-card.jpg)",
            backgroundPosition: position,
          }}
        />
        <img
          src={`${V4_ASSET}/polaroid-landscape-${index % 2 ? "02" : "01"}.png`}
          alt=""
          aria-hidden="true"
        />
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export const dynamic = "force-static";
export const metadata = {
  title: "Homepage V4 · 静态视觉样板",
  robots: { index: false, follow: false },
};

/**
 * A data-free, reference-locked visual laboratory. This route deliberately
 * does not import auth, D1, R2, or any production Homepage component.
 */
export default function HomepageV4() {
  return (
    <main className={styles.canvas} data-visual-lab="home-v4">
      <div className={styles.desktopComposition}>
        <img
          className={styles.desktopShell}
          src={`${V4_ASSET}/desktop-shell-v4.png`}
          alt=""
          aria-hidden="true"
        />

        <header className={styles.desktopHeader}>
          <div className={styles.desktopBrand}>
            <span>Trip.Bossxie</span>
            <small>把世界，装进行程里。</small>
          </div>
          <nav className={styles.desktopNav} aria-label="视觉样板导航">
            <span className={styles.navActive}><Home size={18} />首页</span>
            <span><BriefcaseBusiness size={18} />我的旅行</span>
            <span><Map size={18} />地图</span>
            <span><ImageIcon size={18} />相册</span>
            <span><MessageCircle size={18} />留言</span>
          </nav>
          <div className={styles.desktopAccount}>
            <span className={styles.searchPill}><Search size={16} />搜索目的地、国家或旅行笔记…</span>
            <span className={styles.avatar}>N</span>
            <strong>nini</strong>
            <span className={styles.chevron}>⌄</span>
          </div>
        </header>

        <section className={styles.desktopHero} aria-label="首页视觉样板首屏">
          <article className={styles.desktopManifesto}>
            <img className={styles.titleTape} src={`${ASSET}/tape-blue.webp`} alt="" aria-hidden="true" />
            <img
              className={styles.desktopTitle}
              src={`${ASSET}/title-mobile.png`}
              alt="跳进地理书的旅行"
              width={1448}
              height={1086}
            />
            <div className={styles.desktopStats}>
              <span>已点亮城市 <b>3</b></span>
              <span>已完成旅行 <b>0</b></span>
            </div>
            <div className={styles.desktopActions}>
              <span className={styles.primaryAction}><span>✈</span>规划下一段旅程<ArrowRight size={16} /></span>
              <span className={styles.secondaryAction}><BookOpen size={17} />浏览旅行灵感</span>
            </div>
            <p className={styles.manifestoCaption}>把每一段路，收进自己的地图。</p>
          </article>

          <article className={styles.desktopAtlas}>
            <span className={styles.atlasNote}>在地图上，<br />遇见更大的自己。</span>
            <svg className={styles.atlasRoute} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M45 74 Q54 62 58 54 L60 44" />
            </svg>
            <Marker className={styles.markerShenzhen} name="深圳" />
            <Marker className={styles.markerHangzhou} name="杭州" />
            <Marker className={styles.markerShanghai} name="上海" />
            <img className={styles.atlasTape} src={`${ASSET}/tape-blue.webp`} alt="" aria-hidden="true" />
            <div className={styles.desktopPolaroid}>
              <img className={styles.polaroidPhoto} src="/og-card.jpg" alt="" aria-hidden="true" />
              <img className={styles.polaroidFrame} src={`${ASSET}/polaroid-frame-01.webp`} alt="" aria-hidden="true" />
              <span>上海 · 一页</span>
            </div>
            <div className={styles.desktopPolaroidSecondary}>
              <img className={styles.polaroidPhoto} src="/og-card.jpg" alt="" aria-hidden="true" />
              <img className={styles.polaroidFrame} src={`${ASSET}/polaroid-frame-01.webp`} alt="" aria-hidden="true" />
              <span>杭州</span>
            </div>
            <img className={styles.atlasCompass} src={`${ASSET}/sticker-compass.webp`} alt="" aria-hidden="true" />
          </article>

          <article className={styles.desktopNextTrip}>
            <img className={styles.nextSticker} src={`${ASSET}/sticker-next-trip.webp`} alt="下一站" />
            <h2>上海 · 杭州</h2>
            <time>2025.09.23 — 09.27</time>
            <div className={styles.nextPhoto}>
              <img src="/og-card.jpg" alt="" aria-hidden="true" />
            </div>
            <div className={styles.nextMeta}>
              <span><MapPin size={15} />2 城市</span>
              <span>5 天</span>
              <span>5 人</span>
              <i><ArrowRight size={18} /></i>
            </div>
            <img className={styles.nextStamp} src={`${ASSET}/sticker-airmail.webp`} alt="" aria-hidden="true" />
          </article>
          <img className={styles.desktopCamera} src={`${V4_ASSET}/camera-v4.png`} alt="" aria-hidden="true" />
        </section>

        <section className={styles.desktopLower} aria-label="下方视觉样板">
          <div className={styles.galleryHeading}>
            <span className={styles.sectionIcon}><Camera size={23} /></span>
            <h2>旅行影像墙</h2>
            <p>那些走过的地方，都变成了特别的回忆。</p>
            <span className={styles.sectionLink}>查看全部 →</span>
          </div>
          <div className={styles.galleryRail}>
            {galleryPlaceholders.map((item, index) => (
              <GalleryPlaceholder key={item.label} {...item} index={index} />
            ))}
          </div>
          <section className={styles.myTripsPreview} aria-label="我的旅行静态样板">
            <div className={styles.myTripsHeading}>
              <span className={styles.sectionIcon}><BriefcaseBusiness size={23} /></span>
              <h2>我的旅行</h2>
              <span className={styles.sectionLink}>查看全部 →</span>
            </div>
            <div className={styles.myTripsCards}>
              {[0, 1, 2, 3].map((index) => (
                <article className={styles.myTripCard} data-static-trip-preview key={index} aria-label={`行程卡片占位 ${index + 1}`}>
                  <img src="/og-card.jpg" alt="" aria-hidden="true" style={{ objectPosition: `${index % 2 ? 'right' : 'left'} center` }} />
                  <strong>行程标题</strong>
                  <span className={styles.tripMetadataPlaceholder} aria-hidden="true" />
                  <span className={styles.tripCardArrow} aria-hidden="true"><ArrowRight size={14} /></span>
                </article>
              ))}
            </div>
          </section>
          <div className={styles.guestbookHeading}>
            <span className={styles.sectionIcon}><MessageCircle size={23} /></span>
            <h2>留言板</h2>
            <p>在这里，留下你来时的痕迹。</p>
            <span className={styles.sectionLink}>写下留言 →</span>
          </div>
          <div className={styles.guestbookNotes}>
            {[0, 1, 2].map((note) => (
              <div className={`${styles.noteCard} ${styles[`noteTilt${note}`]}`} key={note}>
                <span className={styles.noteDot} />
                <span className={styles.noteLine} />
                <span className={styles.noteLine} />
                <span className={styles.noteLineShort} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.mobileComposition}>
        <img className={styles.mobileShell} src={`${ASSET}/mobile-shell.webp`} alt="" aria-hidden="true" />
        <header className={styles.mobileTopbar}>
          <div className={styles.mobileTools}><span className={styles.menuIcon}><Menu size={25} /></span><span className={styles.mobileDivider} /><Search size={25} /></div>
          <div className={styles.mobileIdentity}><span className={styles.mobileAvatar}>N</span><strong>nini</strong><span className={styles.mobileDown}>⌄</span></div>
        </header>
        <section className={styles.mobileBookContent} aria-label="移动端视觉样板首屏">
          <span className={styles.mobileNote}>在地图上，<br />遇见更大的自己。</span>
          <img
            className={styles.mobileTitle}
            src={`${ASSET}/title-mobile.png`}
            alt="跳进地理书的旅行"
            width={1448}
            height={1086}
          />
          <div className={styles.mobileStats}>
            <span>已点亮城市 <b>3</b></span>
            <i />
            <span>已完成旅行 <b>0</b></span>
          </div>
          <div className={styles.mobileAtlasFrame}>
            <img className={styles.mobileAtlasImage} src={`${ASSET}/atlas-mobile.webp`} alt="" aria-hidden="true" />
            <svg className={styles.mobileRoute} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M51 67 Q66 55 76 44 L80 31" />
            </svg>
            <Marker className={styles.mobileMarkerShenzhen} name="深圳" />
            <Marker className={styles.mobileMarkerHangzhou} name="杭州" />
            <Marker className={styles.mobileMarkerShanghai} name="上海" />
            <div className={styles.mobilePolaroid}>
              <img className={styles.mobilePolaroidPhoto} src="/og-card.jpg" alt="" aria-hidden="true" />
              <img className={styles.mobilePolaroidFrame} src={`${ASSET}/polaroid-frame-01.webp`} alt="" aria-hidden="true" />
              <span>上海 ♡</span>
            </div>
          </div>
          <img className={styles.mobileStamp} src={`${ASSET}/sticker-airmail.webp`} alt="" aria-hidden="true" />
          <img className={styles.mobileCompass} src={`${ASSET}/sticker-compass.webp`} alt="" aria-hidden="true" />
          <p className={styles.mobileCaption}>Same Places,<br />Different Stories.</p>
        </section>
        <nav className={styles.mobileBottomNav} aria-label="移动端视觉样板导航">
          <span className={styles.bottomActive}><Home size={24} /><b>首页</b></span>
          <span><BriefcaseBusiness size={24} /><b>我的旅行</b></span>
          <span><ImageIcon size={24} /><b>相册</b></span>
          <span><MessageCircle size={24} /><b>留言</b></span>
        </nav>
      </div>
    </main>
  );
}
