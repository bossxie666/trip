/* eslint-disable @next/next/no-img-element */
import { HomeFeaturedPhotoEditor } from "./HomeFeaturedPhotoEditor";

type Point = { placeId: string; name: string; cityName: string; latitude: number | null; longitude: number | null };
type Photo = { slotKey: "map_primary" | "map_secondary"; assetId: string };

function plotted(points: Point[]) {
  const usable = points.filter((point): point is Point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null);
  const cities = [...usable.reduce((groups, point) => {
    const key = point.cityName || point.name;
    const current = groups.get(key) || { key, cityName: key, latitude: 0, longitude: 0, count: 0, placeNames: [] as string[] };
    current.latitude += point.latitude;
    current.longitude += point.longitude;
    current.count += 1;
    current.placeNames.push(point.name);
    groups.set(key, current);
    return groups;
  }, new Map<string, { key: string; cityName: string; latitude: number; longitude: number; count: number; placeNames: string[] }>()).values()]
    .map((city) => ({ ...city, latitude: city.latitude / city.count, longitude: city.longitude / city.count }));
  if (!cities.length) return [];
  const minX = Math.min(...cities.map((point) => point.longitude));
  const maxX = Math.max(...cities.map((point) => point.longitude));
  const minY = Math.min(...cities.map((point) => point.latitude));
  const maxY = Math.max(...cities.map((point) => point.latitude));
  const xSpan = Math.max(maxX - minX, .01);
  const ySpan = Math.max(maxY - minY, .01);
  return cities.map((point, index) => ({ ...point, x: 13 + ((point.longitude - minX) / xSpan) * 74, y: 82 - ((point.latitude - minY) / ySpan) * 66, index }));
}

export function HomeAtlas({ points, photos, fallbackPrimary, fallbackSecondary }: { points: Point[]; photos: Photo[]; fallbackPrimary?: string | null; fallbackSecondary?: string | null }) {
  const plot = plotted(points);
  const primary = photos.find((photo) => photo.slotKey === "map_primary");
  const secondary = photos.find((photo) => photo.slotKey === "map_secondary");
  const path = plot.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return <div className="home-atlas" aria-label="按真实行程地点生成的旅行路线示意图">
    <div className="atlas-caption">TRAVEL ROUTE SKETCH · 非比例地图</div>
    {plot.length ? <svg viewBox="0 0 100 100" role="img" aria-label={`旅行地点：${plot.flatMap((point) => point.placeNames).join("、")}`}>
      <path className="atlas-route" d={path} />
      {plot.map((point) => <g key={point.key} transform={`translate(${point.x} ${point.y})`}><circle r="2.4" /><text x="3.6" y="1.5">{point.cityName}</text></g>)}
    </svg> : <div className="atlas-empty"><b>路线等待落笔</b><span>把真实地点加入行程后，它们会出现在这里。</span></div>}
    <div className="atlas-polaroid atlas-polaroid-primary">
      {(primary || fallbackPrimary) ? <img src={primary ? `/api/media/${primary.assetId}?variant=card` : fallbackPrimary!} alt="旅行地图照片一" width={360} height={260} /> : <div className="atlas-photo-empty">YOUR PHOTO</div>}
      <span>Same places, different stories.</span><HomeFeaturedPhotoEditor slotKey="map_primary" />
    </div>
    <div className="atlas-polaroid atlas-polaroid-secondary">
      {(secondary || fallbackSecondary) ? <img src={secondary ? `/api/media/${secondary.assetId}?variant=card` : fallbackSecondary!} alt="旅行地图照片二" width={300} height={220} /> : <div className="atlas-photo-empty">YOUR PHOTO</div>}
      <span>Collect moments.</span><HomeFeaturedPhotoEditor slotKey="map_secondary" />
    </div>
    <div className="atlas-stamp" aria-hidden="true">GOOD<br />JOURNEY</div>
  </div>;
}
