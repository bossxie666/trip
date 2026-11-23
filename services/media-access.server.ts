import type { mediaAssetRecords } from "@/db/schema";

/** Current resource membership is checked in D1 on every read; no access cache. */
export function findAuthorizedMediaAsset(db: D1Database, assetId: string, memberId: string) {
  return db.prepare(`WITH viewer AS (SELECT ? AS member_id)
    SELECT m.id, m.uploader_member_id AS uploaderMemberId, m.purpose,
      m.object_key AS objectKey, m.original_filename AS originalFilename,
      m.content_type AS contentType, m.byte_size AS byteSize, m.width, m.height,
      m.status, m.created_at AS createdAt, m.updated_at AS updatedAt, m.ready_at AS readyAt
    FROM media_assets m CROSS JOIN viewer WHERE m.id=? AND m.status='ready' AND (
      m.purpose IN ('home_featured','member_avatar','knowledge_image')
      OR (m.purpose='album' AND EXISTS (
        SELECT 1 FROM album_media am JOIN albums a ON a.id=am.album_id
        WHERE am.media_asset_id=m.id AND a.deleted_at IS NULL
          AND (a.created_by_member_id=viewer.member_id OR EXISTS (
            SELECT 1 FROM album_members members WHERE members.album_id=a.id AND members.member_id=viewer.member_id))))
      OR (m.purpose='guestbook' AND (
        EXISTS (SELECT 1 FROM guestbook_message_media gm JOIN guestbook_messages g ON g.id=gm.message_id
          WHERE gm.media_asset_id=m.id AND g.deleted_at IS NULL AND (
            g.visibility='all' OR g.author_member_id=viewer.member_id OR EXISTS (
              SELECT 1 FROM guestbook_message_members members WHERE members.message_id=g.id AND members.member_id=viewer.member_id)))
        OR (m.uploader_member_id=viewer.member_id AND NOT EXISTS (
          SELECT 1 FROM guestbook_message_media gm WHERE gm.media_asset_id=m.id))))
      OR (m.purpose='recommendation_reference' AND (
        EXISTS (SELECT 1 FROM knowledge_entry_media km JOIN knowledge_entries k ON k.id=km.entry_id WHERE km.media_asset_id=m.id AND k.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM recommendation_reference_media rm
          JOIN recommendation_references rr ON rr.id=rm.reference_id
          JOIN recommendations r ON r.id=rr.recommendation_id
          JOIN trip_members tm ON tm.trip_id=r.trip_id
          WHERE rm.media_asset_id=m.id AND r.deleted_at IS NULL AND tm.member_id=viewer.member_id)))
      OR (m.purpose='trip_cover' AND (m.uploader_member_id=viewer.member_id OR EXISTS (
        SELECT 1 FROM trips t JOIN trip_members tm ON tm.trip_id=t.id
          WHERE t.cover LIKE '/api/media/'||m.id||'%' AND tm.member_id=viewer.member_id)))
      OR (m.purpose NOT IN ('home_featured','member_avatar','knowledge_image','album','guestbook','recommendation_reference','trip_cover') AND m.uploader_member_id=viewer.member_id)
    ) LIMIT 1`).bind(memberId, assetId).first<typeof mediaAssetRecords.$inferSelect>();
}
