/* eslint-disable @next/next/no-img-element */
import { HomeFeaturedPhotoEditor } from "./HomeFeaturedPhotoEditor";

type City = { cityId: string; name: string; slug: string; centerLat: number | null; centerLng: number | null; tripStatus?: string };
type Photo = { slotKey: "map_primary" | "map_secondary"; assetId: string };

function plotted(cities: City[]) {
  const usable = cities.filter((city): city is City & { centerLat: number; centerLng: number } => city.centerLat != null && city.centerLng != null);
  if (!usable.length) return [];
  // Keep markers geographically stable when a member has one city or many:
  // the atlas artwork is a China-focused map, so its overlay uses fixed
  // longitude/latitude bounds instead of stretching the current selection.
  const minLng = 73;
  const maxLng = 135;
  const minLat = 18;
  const maxLat = 54;
  return usable.map((city, index) => ({
    ...city,
    x: 9 + Math.min(1, Math.max(0, (city.centerLng - minLng) / (maxLng - minLng))) * 82,
    y: 86 - Math.min(1, Math.max(0, (city.centerLat - minLat) / (maxLat - minLat))) * 72,
    index,
  }));
}

export function HomeAtlas({ cities, photos, fallbackPrimary, fallbackSecondary }: { cities: City[]; photos: Photo[]; fallbackPrimary?: string | null; fallbackSecondary?: string | null }) {
  const plot = plotted(cities);
  const primary = photos.find((photo) => photo.slotKey === "map_primary");
  const secondary = photos.find((photo) => photo.slotKey === "map_secondary");
  return <div className="home-atlas" aria-label="按真实行程城市生成的旅行地图">
    <div className="atlas-paper-map" aria-hidden="true">
      <picture>
        <source media="(max-width: 767px)" srcSet="/assets/homepage-v3/atlas-mobile.webp" />
        <img src="/assets/homepage-v3/atlas-desktop.webp" alt="" />
      </picture>
    </div>
    <div className="atlas-caption">我的旅行地图</div>
    {plot.length ? <svg viewBox="0 0 100 100" role="img" aria-label={`旅行城市：${plot.map((city) => city.name).join("、")}`}>
      {plot.map((city) => <g key={city.cityId} className={`atlas-city-marker atlas-city-marker-${city.tripStatus || "planning"}`} transform={`translate(${city.x} ${city.y})`}><circle r="2.4" /><text x="3.6" y="1.5">{city.name}</text></g>)}
    </svg> : <div className="atlas-empty"><b>地图等待点亮</b><span>把城市加入一条真实行程后，它会出现在这里。</span></div>}
    <figure className="atlas-polaroid atlas-polaroid-primary">
      {(primary || fallbackPrimary) ? <div className="atlas-polaroid-window"><img className={`atlas-polaroid-photo${primary ? "" : " atlas-polaroid-photo-fallback"}`} src={primary ? `/api/media/${primary.assetId}?variant=card` : fallbackPrimary!} alt="旅行地图照片一" width={360} height={260} /></div> : <div className="atlas-photo-empty">暂无照片</div>}
      <img className="atlas-polaroid-frame" src="/assets/homepage-v3/polaroid-frame-01.webp" alt="" aria-hidden="true" />
      <figcaption>旅行照片</figcaption><HomeFeaturedPhotoEditor slotKey="map_primary" />
    </figure>
    <figure className="atlas-polaroid atlas-polaroid-secondary">
      {(secondary || fallbackSecondary) ? <div className="atlas-polaroid-window"><img className={`atlas-polaroid-photo${secondary ? "" : " atlas-polaroid-photo-fallback"}`} src={secondary ? `/api/media/${secondary.assetId}?variant=card` : fallbackSecondary!} alt="旅行地图照片二" width={300} height={220} /></div> : <div className="atlas-photo-empty">暂无照片</div>}
      <img className="atlas-polaroid-frame" src="/assets/homepage-v3/polaroid-frame-02.webp" alt="" aria-hidden="true" />
      <figcaption>地图照片</figcaption><HomeFeaturedPhotoEditor slotKey="map_secondary" />
    </figure>
    <div className="atlas-stamp" aria-hidden="true">旅<br />途</div>
    <div className="atlas-compass" aria-hidden="true"><i>北</i><b>✦</b><span>南</span></div>
  </div>;
}
