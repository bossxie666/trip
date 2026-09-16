/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { readCookie, sessionCookieName, verifySessionToken } from "../services/session";
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

function withSecurityHeaders(response: Response, url: URL) {
  const headers = new Headers(response.headers);
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

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(response, url);
    }

    if (!isPublicPath(url.pathname)) {
      const memberId = await verifySessionToken(readCookie(request, sessionCookieName), env.TRIP_SPACE_SESSION_SECRET);
      const member = memberId ? await env.DB.prepare("SELECT active FROM members WHERE id = ? LIMIT 1").bind(memberId).first<{ active: number }>() : null;
      if (!member?.active) {
        const unlock = new URL("/unlock", request.url);
        unlock.searchParams.set("returnTo", safeInternalReturnTo(`${url.pathname}${url.search}`));
        return withSecurityHeaders(Response.redirect(unlock, 302), url);
      }
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx), url);
  },
};

export default worker;
