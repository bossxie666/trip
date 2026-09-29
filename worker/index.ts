/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { readCookie, sessionCookieName, verifySessionMemberId } from "../services/session";
import { safeInternalReturnTo } from "../services/return-to";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TRIP_SPACE_INVITE_CODE: string;
  TRIP_SPACE_SESSION_SECRET: string;
  AMAP_JS_API_KEY: string;
  AMAP_JS_SECURITY_CODE: string;
  AMAP_WEB_SERVICE_KEY: string;
  MEDIA: R2Bucket;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const publicAssetPrefixes = ["/_next/", "/assets/", "/fonts/", "/maps/"];
const publicAssetFiles = new Set(["/favicon.svg", "/file.svg", "/globe.svg", "/window.svg", "/og.png", "/og-card.jpg", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);

function isPublicPath(pathname: string) {
  return pathname === "/unlock"
    || pathname === "/api/session"
    || publicAssetFiles.has(pathname)
    || publicAssetPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function withSecurityHeaders(response: Response, url: URL, requestId: string) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; worker-src 'self' blob:");
  if (url.protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();

    const finish = (response: Response, failureCategory?: string) => {
      const secured = withSecurityHeaders(response, url, requestId);
      console.log(JSON.stringify({ type: "request", requestId, method: request.method, route: url.pathname, status: secured.status, durationMs: Date.now() - startedAt, failureCategory: failureCategory || null }));
      return secured;
    };

    try {
      if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
        return finish(response);
      }

      if (!isPublicPath(url.pathname)) {
        const memberId = await verifySessionMemberId(readCookie(request, sessionCookieName), env.TRIP_SPACE_SESSION_SECRET, env.DB);
        const member = memberId ? await env.DB.prepare("SELECT active FROM members WHERE id = ? LIMIT 1").bind(memberId).first<{ active: number }>() : null;
        if (!member?.active) {
          const unlock = new URL("/unlock", request.url);
          unlock.searchParams.set("returnTo", safeInternalReturnTo(`${url.pathname}${url.search}`));
          return finish(Response.redirect(unlock, 302), "authentication");
        }
      }

      const appHeaders = new Headers(request.headers); appHeaders.set("x-request-id", requestId);
      return finish(await handler.fetch(new Request(request, { headers: appHeaders }), env, ctx));
    } catch (caught) {
      console.error(JSON.stringify({ type: "request_error", requestId, method: request.method, route: url.pathname, durationMs: Date.now() - startedAt, error: caught instanceof Error ? caught.name : "UnknownError" }));
      return finish(Response.json({ code: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试。", requestId }, { status: 500, headers: { "cache-control": "no-store" } }), "internal");
    }
  },
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanExpiredOperationalData(env));
  },
};

async function cleanExpiredOperationalData(env: Env) {
  const pendingBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rateLimitBefore = Date.now() - 48 * 60 * 60 * 1000;
  const now = new Date().toISOString();
  const revokedSessionBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const pending = await env.DB.prepare("SELECT id, object_key FROM media_assets WHERE status = 'pending' AND created_at < ? LIMIT 500").bind(pendingBefore).all<{ id: string; object_key: string }>();
  if (pending.results?.length) await env.MEDIA.delete(pending.results.map((asset) => asset.object_key));
  const statements = [
    env.DB.prepare("DELETE FROM rate_limits WHERE window_started_at < ?").bind(rateLimitBefore),
    env.DB.prepare("DELETE FROM member_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)").bind(now, revokedSessionBefore),
  ];
  if (pending.results?.length) {
    const placeholders = pending.results.map(() => "?").join(",");
    statements.push(env.DB.prepare(`DELETE FROM media_assets WHERE status = 'pending' AND id IN (${placeholders})`).bind(...pending.results.map((asset) => asset.id)));
  }
  const results = await env.DB.batch(statements);
  console.log(JSON.stringify({ type: "scheduled_cleanup", pendingMediaDeleted: pending.results?.length || 0, operations: results.length }));
}

export default worker;
