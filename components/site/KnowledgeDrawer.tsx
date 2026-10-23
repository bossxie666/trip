"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Aperture, BookOpenText, Camera, Film, Heart, Menu, Search, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";

const items = [
  ["/knowledge", "知识库首页", BookOpenText], ["/knowledge?section=photography", "拍照知识", Camera], ["/knowledge?section=transition_video", "转场视频", Film], ["/knowledge?section=travel_guide", "旅游攻略", Aperture], ["/knowledge?favorite=1", "我的收藏", Heart], ["/persona", "我的形象", UserRound],
] as const;
export function KnowledgeDrawer() {
  const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null), startX = useRef(0), router = useRouter();
  function close() { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }
  useEffect(() => { if (!open) return; const before = document.body.style.overflow; document.body.style.overflow = "hidden"; const escape = (e: KeyboardEvent) => e.key === "Escape" && close(); document.addEventListener("keydown", escape); return () => { document.body.style.overflow = before; document.removeEventListener("keydown", escape); }; }, [open]);
  return <><button ref={trigger} type="button" className="knowledge-menu-trigger" aria-label="打开知识库" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={25} /></button><span className="site-mobile-tools-divider" /><button type="button" className="site-mobile-search-trigger" aria-label="搜索" onClick={() => router.push("/search")}><Search size={24} /></button>{open && typeof document !== "undefined" ? createPortal(<div className="knowledge-drawer-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}><aside className="knowledge-drawer" role="dialog" aria-modal="true" aria-label="知识库导航" onPointerDown={(e) => { startX.current = e.clientX; }} onPointerUp={(e) => { if (e.clientX - startX.current > 80) close(); }}><header><div><small>TRAVEL NOTES</small><h2>知识库</h2></div><button type="button" aria-label="关闭侧边栏" onClick={close}><X size={22} /></button></header><nav>{items.map(([href, label, Icon]) => <a key={href} href={href} onClick={close}><Icon size={21} /><span>{label}</span></a>)}</nav></aside></div>, document.body) : null}</>;
}
