"use client";
import { useEffect, useRef, useState } from "react";
import type { getHomeDesk } from "@/services/home-desk.server";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";

export function TravelDesk({data}:{data:Awaited<ReturnType<typeof getHomeDesk>>}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready,setReady] = useState(false);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    const controller = new AbortController(); let cleanup: (()=>void)|undefined;
    const element = host.current!;
    const shadow = element.shadowRoot || element.attachShadow({mode:"open"});
    async function start(){
      try {
        const response=await fetch("/assets/travel-desk/desk.html",{signal:controller.signal});
        if(!response.ok)throw new Error("DESK_UNAVAILABLE");
        const html=await response.text();
        const moduleUrl="/assets/travel-desk/desk.js";
        const deskModule=await import(/* @vite-ignore */ moduleUrl);
        if(controller.signal.aborted)return;
        shadow.innerHTML=html;
        cleanup=await deskModule.mount(shadow,data,controller.signal);
        if(controller.signal.aborted){cleanup?.();return;}
        setReady(true);
      }catch{if(!controller.signal.aborted)setFailed(true);}
    }
    void start();
    return ()=>{controller.abort();cleanup?.();shadow.replaceChildren();};
  },[data]);
  return <><div ref={host} />{!ready && <section style={{padding:"32px",textAlign:"center"}} aria-live="polite"><h1>跳进地理书的旅行</h1><p>{failed?"立体书暂时无法显示，可直接打开旅行和相册。":"正在准备旅行书…"}</p><Link href="/map">足迹地图</Link> · <Link href="/trips">我的旅行</Link> · <Link href="/albums">相册</Link></section>}</>;
}
