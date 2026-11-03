import { tripCoverCardUrl } from "@/components/media/cover-url";
import { getRuntimeEnv } from "@/db";
import { listTripSummaries } from "@/services/trip-repository.server";

export async function getHomeDesk(memberId: string) {
  const db = getRuntimeEnv().DB;
  const access = "a.deleted_at IS NULL AND (EXISTS (SELECT 1 FROM album_members am WHERE am.album_id=a.id AND am.member_id=?))";
  const [trips, albums, photos] = await Promise.all([
    listTripSummaries("all",memberId),
    db.prepare(`SELECT a.id,a.title,a.cover_media_asset_id AS cover FROM albums a WHERE ${access} ORDER BY a.updated_at DESC LIMIT 8`).bind(memberId).all<{id:string;title:string;cover:string|null}>(),
    db.prepare(`SELECT am.media_asset_id AS id,am.album_id AS albumId,a.title,ma.original_filename AS filename FROM album_media am JOIN albums a ON a.id=am.album_id JOIN media_assets ma ON ma.id=am.media_asset_id WHERE ${access} AND am.is_favorite=1 AND ma.status='ready' ORDER BY coalesce(am.captured_at,am.created_at) DESC,am.sort_order LIMIT 60`).bind(memberId).all<{id:string;albumId:string;title:string;filename:string}>(),
  ]);
  return {
    memberId,
    trips:trips.slice(0,8).map(t=>({id:t.id,title:t.title,cover:tripCoverCardUrl(t.cover),href:`/trips/${t.slug}/plan`})),
    cities:[...new Map(trips.flatMap(t=>t.cities).map(c=>[c.cityId,{name:c.name,lat:c.centerLat,lng:c.centerLng,href:`/cities/${c.slug}`}])).values()],
    albums:albums.results.map(a=>({id:a.id,title:a.title,cover:a.cover?`/api/media/${a.cover}?variant=card`:null,href:`/albums/${a.id}`})),
    photos:photos.results.map(p=>({id:p.id,albumId:p.albumId,title:p.filename||p.title,src:`/api/media/${p.id}?variant=card`,full:`/api/media/${p.id}?variant=display`,href:`/albums/${p.albumId}`})),
  };
}
