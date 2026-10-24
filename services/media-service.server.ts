import { and, eq, isNull, like } from "drizzle-orm";
import { AwsV4Signer } from "aws4fetch";
import { getDb, getRuntimeEnv } from "@/db";
import { albumMediaRecords, albumRecords, homeFeaturedPhotoRecords, mediaAssetRecords, recommendationRecords, recommendationReferenceMediaRecords, recommendationReferenceRecords, tripMemberRecords, tripRecords } from "@/db/schema";
import { wallPhotoSlots } from "./home-media";
import { assertImageSignature, maxImageBytes } from "./media-upload-validation";

export const mediaPurposes = ["home_featured", "guestbook", "recommendation_reference", "trip_cover", "album", "member_avatar", "knowledge_image"] as const;
export type MediaPurpose = (typeof mediaPurposes)[number];
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function safeExtension(filename: string, contentType: string) {
  const mapped: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
  return mapped[contentType] || filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

export function validateMediaInput(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_MEDIA_INPUT");
  const input = raw as Record<string, unknown>;
  if (!mediaPurposes.includes(input.purpose as MediaPurpose)) throw new Error("INVALID_MEDIA_PURPOSE");
  if (typeof input.filename !== "string" || !input.filename.trim() || input.filename.length > 180) throw new Error("INVALID_MEDIA_FILENAME");
  if (typeof input.contentType !== "string" || !allowedTypes.has(input.contentType)) throw new Error("INVALID_MEDIA_TYPE");
  if (!Number.isSafeInteger(input.byteSize) || Number(input.byteSize) <= 0 || Number(input.byteSize) > maxImageBytes) throw new Error("INVALID_MEDIA_SIZE");
  return { purpose: input.purpose as MediaPurpose, filename: input.filename.trim(), contentType: input.contentType, byteSize: Number(input.byteSize) };
}

export async function createDirectUpload(actorMemberId: string, raw: unknown) {
  const input = validateMediaInput(raw);
  const env = getRuntimeEnv();
  if (!env.MEDIA) throw new Error("MEDIA_UPLOAD_NOT_CONFIGURED");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const objectKey = `${input.purpose}/${now.slice(0, 7)}/${id}.${safeExtension(input.filename, input.contentType)}`;
  await getDb().insert(mediaAssetRecords).values({
    id,
    uploaderMemberId: actorMemberId,
    purpose: input.purpose,
    objectKey,
    originalFilename: input.filename,
    contentType: input.contentType,
    byteSize: input.byteSize,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  const direct = await createR2PresignedPut(objectKey, input.contentType);
  return {
    assetId: id,
    uploadUrl: direct?.url || `/api/media/uploads/${encodeURIComponent(id)}/content`,
    method: "PUT" as const,
    headers: direct?.headers || { "content-type": input.contentType },
    expiresInSeconds: 600,
    uploadMode: direct ? "r2" as const : "worker" as const,
  };
}

async function createR2PresignedPut(objectKey: string, contentType: string) {
  const env = getRuntimeEnv();
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = (env.R2_BUCKET_NAME || "trip-archive-media").trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${encodedKey}`);
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await new AwsV4Signer({
    accessKeyId,
    secretAccessKey,
    method: "PUT",
    url: url.toString(),
    headers: { "content-type": contentType },
    service: "s3",
    region: "auto",
    signQuery: true,
  }).sign();
  return { url: signed.url.toString(), headers: { "content-type": contentType } };
}

export async function uploadMediaContent(actorMemberId: string, assetId: string, contentType: string | null, bytes: ArrayBuffer) {
  const env = getRuntimeEnv();
  if (!env.MEDIA) throw new Error("MEDIA_UPLOAD_NOT_CONFIGURED");
  const asset = (await getDb().select().from(mediaAssetRecords).where(and(eq(mediaAssetRecords.id, assetId), eq(mediaAssetRecords.uploaderMemberId, actorMemberId))).limit(1))[0];
  if (!asset) throw new Error("MEDIA_NOT_FOUND");
  if (asset.status !== "pending") throw new Error("MEDIA_UPLOAD_ALREADY_COMPLETE");
  if (contentType !== asset.contentType || bytes.byteLength !== asset.byteSize) throw new Error("MEDIA_UPLOAD_MISMATCH");
  if (bytes.byteLength > maxImageBytes) throw new Error("MEDIA_UPLOAD_TOO_LARGE");
  assertImageSignature(asset.contentType, bytes);
  await env.MEDIA.put(asset.objectKey, bytes, { httpMetadata: { contentType: asset.contentType } });
  return { ok: true };
}

export async function completeDirectUpload(actorMemberId: string, assetId: string, dimensions?: { width?: number | null; height?: number | null }) {
  const env = getRuntimeEnv();
  if (!env.MEDIA) throw new Error("MEDIA_UPLOAD_NOT_CONFIGURED");
  const asset = (await getDb().select().from(mediaAssetRecords).where(and(eq(mediaAssetRecords.id, assetId), eq(mediaAssetRecords.uploaderMemberId, actorMemberId))).limit(1))[0];
  if (!asset) throw new Error("MEDIA_NOT_FOUND");
  if (asset.status === "ready") return asset;
  const object = await env.MEDIA.head(asset.objectKey);
  if (!object || object.size !== asset.byteSize) throw new Error("MEDIA_UPLOAD_INCOMPLETE");
  if (object.size > maxImageBytes) throw new Error("MEDIA_UPLOAD_TOO_LARGE");
  // The presigned R2 path bypasses Worker PUT, so validate it here too. Read
  // only a prefix and require the same ETag as HEAD to avoid checking another object.
  const prefix = await env.MEDIA.get(asset.objectKey, { range: { offset: 0, length: Math.min(64, object.size) }, onlyIf: { etagMatches: object.etag } });
  if (!prefix || !("body" in prefix) || prefix.size !== object.size) throw new Error("MEDIA_UPLOAD_INCOMPLETE");
  assertImageSignature(asset.contentType, await prefix.arrayBuffer());
  const now = new Date().toISOString();
  const width = dimensions?.width && Number.isSafeInteger(dimensions.width) && dimensions.width > 0 ? dimensions.width : null;
  const height = dimensions?.height && Number.isSafeInteger(dimensions.height) && dimensions.height > 0 ? dimensions.height : null;
  await getDb().update(mediaAssetRecords).set({ status: "ready", width, height, readyAt: now, updatedAt: now }).where(eq(mediaAssetRecords.id, assetId));
  return { ...asset, status: "ready" as const, width, height, readyAt: now, updatedAt: now };
}

export async function getReadyMediaAsset(assetId: string) {
  return (await getDb().select().from(mediaAssetRecords).where(and(eq(mediaAssetRecords.id, assetId), eq(mediaAssetRecords.status, "ready"))).limit(1))[0] || null;
}

/**
 * A media UUID is not itself an authorization boundary.  Shared homepage and
 * guestbook media are visible to authenticated members; album and
 * recommendation-reference media inherit the owning album/trip membership.
 */
export async function getAuthorizedReadyMediaAsset(assetId: string, memberId: string) {
  const asset = await getReadyMediaAsset(assetId);
  if (!asset) return null;
  if (asset.purpose === "home_featured" || asset.purpose === "guestbook" || asset.purpose === "member_avatar" || asset.purpose === "knowledge_image") return asset;
  const db = getDb();
  if (asset.purpose === "album") {
    const albums = await db.select({ tripId: albumRecords.tripId, memberId: tripMemberRecords.memberId }).from(albumMediaRecords)
      .innerJoin(albumRecords, eq(albumRecords.id, albumMediaRecords.albumId))
      .leftJoin(tripMemberRecords, and(eq(tripMemberRecords.tripId, albumRecords.tripId), eq(tripMemberRecords.memberId, memberId)))
      .where(and(eq(albumMediaRecords.mediaAssetId, assetId), isNull(albumRecords.deletedAt)));
    return albums.some((album) => !album.tripId || album.memberId) ? asset : null;
  }
  if (asset.purpose === "recommendation_reference") {
    const member = (await db.select({ memberId: tripMemberRecords.memberId }).from(recommendationReferenceMediaRecords)
      .innerJoin(recommendationReferenceRecords, eq(recommendationReferenceRecords.id, recommendationReferenceMediaRecords.referenceId))
      .innerJoin(recommendationRecords, eq(recommendationRecords.id, recommendationReferenceRecords.recommendationId))
      .innerJoin(tripMemberRecords, eq(tripMemberRecords.tripId, recommendationRecords.tripId))
      .where(and(eq(recommendationReferenceMediaRecords.mediaAssetId, assetId), eq(tripMemberRecords.memberId, memberId), isNull(recommendationRecords.deletedAt))).limit(1))[0];
    return member ? asset : null;
  }
  if (asset.purpose === "trip_cover") {
    // Trip covers are private to members of the Trip that references them.
    // The uploader-only fallback keeps an orphaned/pending cover visible to
    // its owner without making an unreferenced asset public to other members.
    const coverMarker = `/api/media/${assetId}`;
    const memberTrip = (await db.select({ tripId: tripRecords.id })
      .from(tripRecords)
      .innerJoin(tripMemberRecords, eq(tripMemberRecords.tripId, tripRecords.id))
      .where(and(like(tripRecords.cover, `${coverMarker}%`), eq(tripMemberRecords.memberId, memberId))).limit(1))[0];
    return memberTrip || asset.uploaderMemberId === memberId ? asset : null;
  }
  return asset.uploaderMemberId === memberId ? asset : null;
}

export async function setHomeFeaturedPhoto(actorMemberId: string, slotKey: "map_primary" | "map_secondary", assetId: string) {
  await requireHomeLibraryPhoto(actorMemberId, assetId);
  const now = new Date().toISOString();
  await getDb().insert(homeFeaturedPhotoRecords).values({ slotKey, mediaAssetId: assetId, updatedByMemberId: actorMemberId, updatedAt: now }).onConflictDoUpdate({
    target: homeFeaturedPhotoRecords.slotKey,
    set: { mediaAssetId: assetId, updatedByMemberId: actorMemberId, updatedAt: now },
  });
  return { slotKey, assetId };
}

async function requireHomeLibraryPhoto(memberId: string, assetId: string) {
  const asset = await getAuthorizedReadyMediaAsset(assetId, memberId);
  if (!asset || !["album", "trip_cover", "home_featured"].includes(asset.purpose)) throw new Error("INVALID_HOME_MEDIA");
  return asset;
}

export async function setHomeWallPhotos(actorMemberId: string, assetIds: string[]) {
  if (assetIds.length > wallPhotoSlots.length || new Set(assetIds).size !== assetIds.length || assetIds.some((id) => typeof id !== "string" || !id)) throw new Error("INVALID_HOME_MEDIA");
  await Promise.all(assetIds.map((id) => requireHomeLibraryPhoto(actorMemberId, id)));
  const env = getRuntimeEnv();
  const now = new Date().toISOString();
  // Replace only the wall relation, atomically; Atlas slots and R2 objects are untouched.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM home_featured_photos WHERE slot_key IN (${wallPhotoSlots.map(() => "?").join(",")})`).bind(...wallPhotoSlots),
    ...assetIds.map((assetId, index) => env.DB.prepare("INSERT INTO home_featured_photos (slot_key, media_asset_id, updated_by_member_id, updated_at) VALUES (?, ?, ?, ?)").bind(wallPhotoSlots[index], assetId, actorMemberId, now)),
  ]);
  return { assetIds };
}

export async function clearHomeAtlasPhoto(memberId: string, slotKey: "map_primary" | "map_secondary") {
  const row = (await getDb().select().from(homeFeaturedPhotoRecords).where(eq(homeFeaturedPhotoRecords.slotKey, slotKey)).limit(1))[0];
  if (row && !await getAuthorizedReadyMediaAsset(row.mediaAssetId, memberId)) throw new Error("INVALID_HOME_MEDIA");
  await getDb().delete(homeFeaturedPhotoRecords).where(eq(homeFeaturedPhotoRecords.slotKey, slotKey));
}

export async function listHomeFeaturedPhotos(memberId: string) {
  const rows = await getDb().select({ slotKey: homeFeaturedPhotoRecords.slotKey, assetId: mediaAssetRecords.id, width: mediaAssetRecords.width, height: mediaAssetRecords.height })
    .from(homeFeaturedPhotoRecords)
    .innerJoin(mediaAssetRecords, eq(homeFeaturedPhotoRecords.mediaAssetId, mediaAssetRecords.id))
    .where(eq(mediaAssetRecords.status, "ready"));
  const visible = await Promise.all(rows.map(async (row) => await getAuthorizedReadyMediaAsset(row.assetId, memberId) ? row : null));
  return visible.filter((row): row is typeof rows[number] => row !== null).sort((a, b) => a.slotKey.localeCompare(b.slotKey));
}
