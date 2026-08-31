"use client";

import { GenericTripMap } from "@/components/trip/GenericTripMap";
import type { PlaceWorkspace } from "@/services/place-repository.server";

type ShanghaiHangzhouMapDeskProps = {
  slug: string;
  initial: NonNullable<PlaceWorkspace>;
  cityId?: string;
};

/**
 * Shanghai + Hangzhou's map-only adapter. The surrounding trip detail keeps
 * its decision, budget and Disney sections unchanged; this component feeds
 * the D2 AMap surface with the persisted Trip/Day/Place workspace.
 */
export function ShanghaiHangzhouMapDesk({ slug, initial, cityId }: ShanghaiHangzhouMapDeskProps) {
  return (
    <div className="shanghai-hangzhou-map-desk">
      <p className="map-data-note">地图地点读取自这趟旅行的 Day / Place 数据；候选地点仅作弱标记，已选或锁定地点才进入路线。</p>
      <GenericTripMap slug={slug} initial={initial} cityId={cityId} />
    </div>
  );
}
