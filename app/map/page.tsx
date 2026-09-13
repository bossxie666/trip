/* eslint-disable @next/next/no-html-link-for-pages */
import { getCurrentMember } from "@/services/auth.server";
import { SiteHeader } from "@/components/site/SiteHeader";

export default async function MapPage() {
  const current = await getCurrentMember();
  return <>{current && <SiteHeader active="map" currentMember={{ id: current.id, displayName: current.displayName, avatar: current.avatar }} />}<main className="archive-placeholder"><h1>旅行地图</h1><p>详细地图继续由每条行程的 Planning 顺序驱动；这里保留所有行程的地图入口。</p><a href="/trips">打开我的旅行</a></main></>;
}
