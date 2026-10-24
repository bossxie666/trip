/* eslint-disable @next/next/no-img-element */
import { HomeCityMap } from "./HomeCityMap";
import { HomePhotoPicker } from "./HomePhotoPicker";
import type { AtlasCity } from "@/services/atlas-cities";
import type { HomePhotoSlot } from "@/services/home-media";

type Photo = { slotKey: HomePhotoSlot; assetId: string };
type CityTrip = { id: string; title: string; slug: string; cityIds: string[] };

export function HomeAtlas({ cities, trips, photos, reference = false }: { cities: AtlasCity[]; trips: CityTrip[]; photos: Photo[]; reference?: boolean }) {
  const primary = photos.find((photo) => photo.slotKey === "map_primary");
  const secondary = photos.find((photo) => photo.slotKey === "map_secondary");
  return <div className="home-atlas" aria-label={cities.length ? `旅行城市：${cities.map((city) => city.name).join("、")}` : "暂无行程城市"}>
    <div className="atlas-paper-map" aria-hidden="true">
      {reference ? <img src="/assets/homepage-v4/china-map.webp" alt="" width={1118} height={794} fetchPriority="high" /> : <picture>
        <source media="(max-width: 767px)" srcSet="/assets/homepage-v3/atlas-mobile.webp" />
        <img src="/assets/homepage-v3/atlas-desktop.webp" alt="" />
      </picture>}
    </div>
    <div className="atlas-caption">旅行地图</div>
    <div className="atlas-live-map"><HomeCityMap cities={cities} trips={trips} embedded /></div>
    <figure className="atlas-polaroid atlas-polaroid-primary">
      {primary ? <div className="atlas-polaroid-window"><img className="atlas-polaroid-photo" src={`/api/media/${encodeURIComponent(primary.assetId)}?variant=card`} alt="旅行地图照片一" width={360} height={260} /></div> : <div className="atlas-photo-empty">暂无照片</div>}
      {!reference && <img className="atlas-polaroid-frame" src="/assets/homepage-v3/polaroid-frame-01.webp" alt="" aria-hidden="true" />}
      <figcaption><HomePhotoPicker slot="map_primary" selectedIds={primary ? [primary.assetId] : []} /></figcaption>
    </figure>
    <figure className="atlas-polaroid atlas-polaroid-secondary">
      {secondary ? <div className="atlas-polaroid-window"><img className="atlas-polaroid-photo" src={`/api/media/${encodeURIComponent(secondary.assetId)}?variant=card`} alt="旅行地图照片二" width={300} height={220} loading="lazy" /></div> : <div className="atlas-photo-empty">暂无照片</div>}
      {!reference && <img className="atlas-polaroid-frame" src="/assets/homepage-v3/polaroid-frame-02.webp" alt="" aria-hidden="true" />}
      <figcaption><HomePhotoPicker slot="map_secondary" selectedIds={secondary ? [secondary.assetId] : []} /></figcaption>
    </figure>
    {!reference && <><img className="atlas-stamp-asset" src="/assets/homepage-v3/sticker-airmail.webp" alt="" aria-hidden="true" />
      <img className="atlas-compass-asset" src="/assets/homepage-v3/sticker-compass.webp" alt="" aria-hidden="true" /></>}
  </div>;
}
