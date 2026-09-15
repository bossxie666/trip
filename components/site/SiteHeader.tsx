import { BriefcaseBusiness, Home, Images, Map, MessageSquareText, Search, Menu } from "lucide-react";
import { MemberIdentityControl, type SessionMemberSummary } from "@/components/auth/MemberIdentityControl";
import { WorkspaceNavLink } from "@/components/trip/WorkspaceNavLink";

const links = [
  { href: "/", label: "首页", icon: Home },
  { href: "/trips", label: "我的旅行", icon: BriefcaseBusiness },
  { href: "/map", label: "地图", icon: Map },
  { href: "/albums", label: "相册", icon: Images },
  { href: "/messages", label: "留言", icon: MessageSquareText },
];

type SiteNavProps = { active?: "home" | "trips" | "map" | "albums" | "messages" | ""; home?: boolean };

export function SiteMobileNav({ active = "", home = false }: SiteNavProps) {
  return home
    ? <nav className="site-mobile-nav" data-home-nav="true" aria-label="移动端主导航">
      <WorkspaceNavLink href="/" className={active === "home" ? "active" : ""}><Home size={21} /><span>首页</span></WorkspaceNavLink>
      <WorkspaceNavLink href="/trips" className={active === "trips" ? "active" : ""}><BriefcaseBusiness size={21} /><span>我的旅行</span></WorkspaceNavLink>
      <WorkspaceNavLink href="/albums" className={active === "albums" ? "active" : ""}><Images size={21} /><span>相册</span></WorkspaceNavLink>
      <WorkspaceNavLink href="/messages" className={active === "messages" ? "active" : ""}><MessageSquareText size={21} /><span>留言</span></WorkspaceNavLink>
    </nav>
    : <nav className="site-mobile-nav" aria-label="移动端主导航">
      <WorkspaceNavLink href="/" className={active === "home" ? "active" : ""}><Home size={21} /><span>首页</span></WorkspaceNavLink>
      <WorkspaceNavLink href="/trips" className={active === "trips" ? "active" : ""}><BriefcaseBusiness size={21} /><span>我的旅行</span></WorkspaceNavLink>
      <WorkspaceNavLink href="/albums" className={active === "albums" ? "active" : ""}><Images size={21} /><span>相册</span></WorkspaceNavLink>
      <WorkspaceNavLink href="/messages" className={active === "messages" ? "active" : ""}><MessageSquareText size={21} /><span>留言</span></WorkspaceNavLink>
    </nav>;
}

export function SiteHeader({ currentMember, active = "", renderMobileNav = true }: { currentMember: SessionMemberSummary; active?: SiteNavProps["active"]; renderMobileNav?: boolean }) {
  return <>
    <header className="site-header">
      <div className="site-mobile-tools" aria-hidden="true">
        <Menu size={25} />
        <span className="site-mobile-tools-divider" />
        <Search size={24} />
      </div>
      <WorkspaceNavLink className="site-brand" href="/" aria-label="Trip Bossxie 首页"><b>Trip.Bossxie</b><span>把世界，装进行程里。</span></WorkspaceNavLink>
      <nav className="site-desktop-nav" aria-label="网站主导航">
        {links.map(({ href, label, icon: Icon }) => <WorkspaceNavLink key={label} href={href} className={(active === "home" && href === "/") || (active === "trips" && href === "/trips") || (active === "map" && href === "/map") || (active === "albums" && href === "/albums") || (active === "messages" && href === "/messages") ? "active" : ""}><Icon size={17} aria-hidden="true" /><span>{label}</span></WorkspaceNavLink>)}
      </nav>
      <form className="site-search" action="/search"><Search size={16} aria-hidden="true" /><input name="q" aria-label="搜索旅行内容" placeholder="搜索目的地、国家或旅行笔记…" /></form>
      <MemberIdentityControl compact currentMember={currentMember} />
    </header>
    {renderMobileNav ? <SiteMobileNav active={active} /> : null}
  </>;
}
