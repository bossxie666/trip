import {getRuntimeEnv} from "@/db";
export async function canAccessAlbum(albumId:string,memberId:string) {
  return Boolean(await getRuntimeEnv().DB.prepare("SELECT a.id FROM albums a WHERE a.id=? AND a.deleted_at IS NULL AND (a.created_by_member_id=? OR EXISTS(SELECT 1 FROM album_members am WHERE am.album_id=a.id AND am.member_id=?)) LIMIT 1").bind(albumId,memberId,memberId).first());
}
export async function validatedAlbumMembers(value:unknown,owner:string) {
  if(value!==undefined && (!Array.isArray(value)||value.length>100||value.some(id=>typeof id!=="string")))throw new Error("INVALID_ALBUM_MEMBERS");
  const ids=[...new Set([owner,...(value as string[]|undefined||[])])];
  const rows=await getRuntimeEnv().DB.prepare(`SELECT id FROM members WHERE active=1 AND id IN (${ids.map(()=>"?").join(",")})`).bind(...ids).all<{id:string}>();
  if(rows.results.length!==ids.length)throw new Error("INVALID_ALBUM_MEMBERS");
  return ids;
}
