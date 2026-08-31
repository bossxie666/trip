"use client";

import { useMemo } from "react";
import { GenericTripMap } from "@/components/trip/GenericTripMap";
import type { PlaceWorkspace } from "@/services/place-repository.server";

type ShanghaiHangzhouMapDeskProps = {
  slug: string;
  initial: NonNullable<PlaceWorkspace>;
  stageId?: string;
  cityId?: string;
};

const cityCenters: Record<string, readonly [number, number]> = {
  上海: [121.4737, 31.2304],
  杭州: [120.1551, 30.2741],
};

/**
 * Shanghai + Hangzhou's map-only adapter. The surrounding trip detail keeps
 * its decision, budget and Disney sections unchanged; this component feeds
 * the D2 AMap surface with the persisted Trip/Day/Place workspace.
 */
export function ShanghaiHangzhouMapDesk({ slug, initial, stageId, cityId }: ShanghaiHangzhouMapDeskProps) {
  const currentStage = initial.stages.find((stage) => stage.id === stageId)
    ?? initial.stages.find((stage) => stage.cityId === cityId);
  const activeCityId = currentStage?.cityId ?? cityId ?? initial.cities[0]?.id;
  const activeCityName = currentStage?.city?.name ?? initial.cities.find((city) => city.id === activeCityId)?.name;
  const scopedWorkspace = useMemo(() => ({
    ...initial,
    cities: initial.cities.filter((city) => city.id === activeCityId),
    stages: currentStage ? [currentStage] : [],
    availablePlaces: initial.availablePlaces.filter((place) => place.cityId === activeCityId),
    tripPlaces: initial.tripPlaces.filter((item) => item.place.cityId === activeCityId),
    days: initial.days
      .map((day) => ({ ...day, places: day.places.filter((item) => item.place.cityId === activeCityId) }))
      .filter((day) => day.places.length > 0),
  }), [activeCityId, currentStage, initial]);

  return (
    <div className="shanghai-hangzhou-map-desk">
      <p className="map-data-note">地图地点读取自这趟旅行的 Day / Place 数据；候选地点仅作弱标记，已选或锁定地点才进入路线。</p>
      <GenericTripMap key={activeCityId} slug={slug} initial={scopedWorkspace} cityId={activeCityId} fallbackCenter={activeCityName ? cityCenters[activeCityName] : undefined} />
    </div>
  );
}
