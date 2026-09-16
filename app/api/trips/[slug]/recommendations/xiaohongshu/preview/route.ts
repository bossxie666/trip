import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { consumeRateLimit, rateLimitResponse } from "@/services/rate-limit.server";

const allowedHosts = ["xiaohongshu.com", "xhslink.com"];
const maximumBytes = 1_000_000;

function allowedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error("INVALID_XHS_URL");
  return url;
}

async function readLimited(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) { await reader.cancel(); throw new Error("XHS_RESPONSE_TOO_LARGE"); }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

function decodeHtml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decodeHtml(match[1]); }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const limit = await consumeRateLimit("xhs-preview", actor.id, 30, 60 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit, "链接预览过于频繁，请稍后再试。");
  const { slug } = await params;
  const trip = (await getDb().select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
  if (!(await getDb().select({ id: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
  try {
    const body = await request.json() as { url?: string };
    let url = allowedUrl(body.url?.trim() || "");
    let response: Response | null = null;
    for (let redirect = 0; redirect < 3; redirect += 1) {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000), headers: { accept: "text/html,application/xhtml+xml", "user-agent": "TripBossxie/1.0 public-metadata-preview" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("XHS_REDIRECT_FAILED");
      url = allowedUrl(new URL(location, url).href);
    }
    if (!response?.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("XHS_UNAVAILABLE");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > maximumBytes) throw new Error("XHS_RESPONSE_TOO_LARGE");
    const html = await readLimited(response);
    const title = meta(html, "og:title") || meta(html, "twitter:title");
    const description = meta(html, "og:description") || meta(html, "description");
    const author = meta(html, "author");
    const image = meta(html, "og:image");
    if (!title && !description && !author) return Response.json({ sourceUrl: url.href, verified: false, error: "原帖公开信息无法可靠读取，请手动补充。" }, { status: 200 });
    return Response.json({ sourceUrl: url.href, verified: true, title, author, summary: description, imageUrls: image ? [image] : [] });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_XHS_URL") return Response.json({ error: "请粘贴真实的小红书 https 链接。" }, { status: 400 });
    return Response.json({ verified: false, error: "原帖暂时无法可靠读取，已保留手动填写方式。" }, { status: 200 });
  }
}
