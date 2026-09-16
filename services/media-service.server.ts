import { and, eq, isNull } from "drizzle-orm";
import { AwsClient } from "aws4fetch";
import { getDb, getRuntimeEnv } from "@/db";
import { albumMediaRecords, albumRecords, homeFeaturedPhotoRecords, mediaAssetRecords, recommendationRecords, recommendationReferenceMediaRecords, recommendationReferenceRecords, tripMemberRecords } from "@/db/schema";

export const mediaPurposes = ["home_featured", "guestbook", "recommendation_reference", "trip_cover", "album"] as const;
export type MediaPurpose = (typeof mediaPurposes)[number];
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxImageBytes = 10 * 1024 * 1024;

function safeExtension(filename: string, contentType: string) {
  const mapped: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
  return mapped[contentType] || filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

export function validateMediaInput(input: { purpose?: string; filename?: string; contentType?: string; byteSize?: number }) {
  if (!mediaPurposes.includes(input.purpose as MediaPurpose)) throw new Error("INVALID_MEDIA_PURPOSE");
  if (!input.filename?.trim() || input.filename.length > 180) throw new Error("INVALID_MEDIA_FILENAME");
  if (!input.contentType || !allowedTypes.has(input.contentType)) throw new Error("INVALID_MEDIA_TYPE");
  if (!Number.isSafeInteger(input.byteSize) || Number(input.byteSize) <= 0 || Number(input.byteSize) > maxImageBytes) throw new Error("INVALID_MEDIA_SIZE");
  return { purpose: input.purpose as MediaPurpose, filename: input.filename.trim(), contentType: input.contentType, byteSize: Number(input.byteSize) };
}

export async function createDirectUpload(actorMemberId: string, raw: { purpose?: string; filename?: string; contentType?: string; byteSize?: number }) {
  const input = validateMediaInput(raw);
  const env = getRuntimeEnv();
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET_NAME?.trim() || "trip-archive-media";
  if (!accountId || !accessKeyId || !secretAccessKey || !env.MEDIA) throw new Error("MEDIA_UPLOAD_NOT_CONFIGURED");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const objectKey = `${input.purpose}/${now.slice(0, 7)}/${id}.${safeExtension(input.filename, input.contentType)}`;
  const endpoint = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`);
  endpoint.searchParams.set("X-Amz-Expires", "600");
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto", retries: 0 });
  const signed = await aws.sign(endpoint, { method: "PUT", headers: { "content-type": input.contentType }, aws: { signQuery: true, service: "s3", region: "auto" } });

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
  return { assetId: id, uploadUrl: signed.url, method: "PUT" as const, headers: { "content-type": input.contentType }, expiresInSeconds: 600 };
}

export async function completeDirectUpload(actorMemberId: string, assetId: string, dimensions?: { width?: number | null; height?: number | null }) {
  const env = getRuntimeEnv();
  if (!env.MEDIA) throw new Error("MEDIA_UPLOAD_NOT_CONFIGURED");
  const asset = (await getDb().select().from(mediaAssetRecords).where(and(eq(mediaAssetRecords.id, assetId), eq(mediaAssetRecords.uploaderMemberId, actorMemberId))).limit(1))[0];
  if (!asset) throw new Error("MEDIA_NOT_FOUND");
  if (asset.status === "ready") return asset;
  const object = await env.MEDIA.head(asset.objectKey);
  if (!object || object.size !== asset.byteSize) throw new Error("MEDIA_UPLOAD_INCOMPLETE");
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
  if (asset.purpose === "home_featured" || asset.purpose === "guestbook") return asset;
  const db = getDb();
  if (asset.purpose === "album") {
    const album = (await db.select({ tripId: albumRecords.tripId }).from(albumMediaRecords)
      .innerJoin(albumRecords, eq(albumRecords.id, albumMediaRecords.albumId))
      .where(and(eq(albumMediaRecords.mediaAssetId, assetId), isNull(albumRecords.deletedAt))).limit(1))[0];
    if (!album) return null;
    if (!album.tripId) return asset;
    const member = (await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords)
      .where(and(eq(tripMemberRecords.tripId, album.tripId), eq(tripMemberRecords.memberId, memberId))).limit(1))[0];
    return member ? asset : null;
  }
  if (asset.purpose === "recommendation_reference") {
    const member = (await db.select({ memberId: tripMemberRecords.memberId }).from(recommendationReferenceMediaRecords)
      .innerJoin(recommendationReferenceRecords, eq(recommendationReferenceRecords.id, recommendationReferenceMediaRecords.referenceId))
      .innerJoin(recommendationRecords, eq(recommendationRecords.id, recommendationReferenceRecords.recommendationId))
      .innerJoin(tripMemberRecords, eq(tripMemberRecords.tripId, recommendationRecords.tripId))
      .where(and(eq(recommendationReferenceMediaRecords.mediaAssetId, assetId), eq(tripMemberRecords.memberId, memberId), isNull(recommendationRecords.deletedAt))).limit(1))[0];
    return member ? asset : null;
  }
  return asset.uploaderMemberId === memberId ? asset : null;
}

export async function setHomeFeaturedPhoto(actorMemberId: string, slotKey: "map_primary" | "map_secondary", assetId: string) {
  const asset = await getReadyMediaAsset(assetId);
  if (!asset || asset.purpose !== "home_featured" || asset.uploaderMemberId !== actorMemberId) throw new Error("INVALID_HOME_MEDIA");
  const now = new Date().toISOString();
  await getDb().insert(homeFeaturedPhotoRecords).values({ slotKey, mediaAssetId: assetId, updatedByMemberId: actorMemberId, updatedAt: now }).onConflictDoUpdate({
    target: homeFeaturedPhotoRecords.slotKey,
    set: { mediaAssetId: assetId, updatedByMemberId: actorMemberId, updatedAt: now },
  });
  return { slotKey, assetId };
}

export async function listHomeFeaturedPhotos() {
  return getDb().select({ slotKey: homeFeaturedPhotoRecords.slotKey, assetId: mediaAssetRecords.id, width: mediaAssetRecords.width, height: mediaAssetRecords.height })
    .from(homeFeaturedPhotoRecords)
    .innerJoin(mediaAssetRecords, eq(homeFeaturedPhotoRecords.mediaAssetId, mediaAssetRecords.id))
    .where(eq(mediaAssetRecords.status, "ready"));
}
