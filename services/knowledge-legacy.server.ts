import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { recommendationRecords, recommendationReferenceRecords } from "@/db/schema";

function httpsUrl(value: unknown) {
  try { const url = new URL(String(value)); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}

export async function getLegacyKnowledgeDetails(recommendationId: string | null) {
  if (!recommendationId) return null;
  const db = getDb();
  const [rows, references] = await Promise.all([
    db.select().from(recommendationRecords).where(eq(recommendationRecords.id, recommendationId)).limit(1),
    db.select().from(recommendationReferenceRecords).where(eq(recommendationReferenceRecords.recommendationId, recommendationId)).orderBy(asc(recommendationReferenceRecords.sortOrder)),
  ]);
  const record = rows[0]; if (!record) return null;
  return {
    category: record.category, durationMinutes: record.estimatedDurationMinutes,
    priceMinMinor: record.priceMinMinor ?? record.estimatedCostMinor, priceMaxMinor: record.priceMaxMinor,
    priceCurrency: record.priceCurrency || "CNY", priceBasis: record.priceBasis || record.costBasis,
    references: references.map(reference => {
      let images: string[] = [];
      try { const values = JSON.parse(reference.imageUrlsJson || "[]"); if (Array.isArray(values)) images = values.map(httpsUrl).filter((url): url is string => !!url); } catch { /* Malformed legacy metadata must not break the article. */ }
      return { id: reference.id, title: reference.title, authorLabel: reference.authorLabel, platform: reference.platform, url: httpsUrl(reference.sourceUrl), note: reference.note, images };
    }),
  };
}
