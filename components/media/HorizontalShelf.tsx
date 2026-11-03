"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
export function HorizontalShelf({children}:{children:ReactNode}) {
  const rail=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;scroll:number;active:boolean}|null>(null),suppress=useRef(false);
  const [scroll, setScroll] = useState({ overflow: false, back: false, forward: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => {
      const overflow = element.scrollWidth > element.clientWidth + 2;
      const style = getComputedStyle(element);
      const start = parseFloat(style.paddingLeft) || 0, end = parseFloat(style.paddingRight) || 0;
      const next = { overflow, back: overflow && element.scrollLeft > start + 2, forward: overflow && element.scrollLeft + element.clientWidth < element.scrollWidth - end - 2 };
      setScroll(current => current.overflow === next.overflow && current.back === next.back && current.forward === next.forward ? current : next);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const frame = requestAnimationFrame(update);
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); element.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [children]);
  return <section aria-label="相册书架"><div className="album-shelf-controls" hidden={!scroll.overflow}><button type="button" aria-label="上一组相册" disabled={!scroll.back} onClick={()=>rail.current?.scrollBy({left:-rail.current.clientWidth,behavior:"smooth"})}>←</button><button type="button" aria-label="下一组相册" disabled={!scroll.forward} onClick={()=>rail.current?.scrollBy({left:rail.current.clientWidth,behavior:"smooth"})}>→</button></div><div ref={rail} className="album-grid album-book-grid album-drag-shelf"
    onDragStart={e=>e.preventDefault()} onPointerDown={e=>{if(e.pointerType!=="mouse"||e.button!==0||e.target instanceof Element&&e.target.closest("input,.album-book-menu-trigger"))return;drag.current={x:e.clientX,y:e.clientY,scroll:e.currentTarget.scrollLeft,active:false};suppress.current=false;}}
    onPointerMove={e=>{const d=drag.current;if(!d)return;if(!(e.buttons&1)){drag.current=null;return;}const dx=e.clientX-d.x;if(!d.active&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(e.clientY-d.y)){d.active=true;suppress.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(d.active){e.preventDefault();e.currentTarget.scrollLeft=d.scroll-dx;}}}
    onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{drag.current=null;suppress.current=false;}}
    onClickCapture={e=>{if(suppress.current){e.preventDefault();e.stopPropagation();suppress.current=false;}}}>{children}</div></section>;
}
