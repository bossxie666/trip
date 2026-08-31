/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { readCookie, sessionCookieName, verifySessionToken } from "../services/session";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TRIP_SPACE_INVITE_CODE: string;
  TRIP_SPACE_SESSION_SECRET: string;
  AMAP_JS_API_KEY: string;
  AMAP_JS_SECURITY_CODE: string;
  AMAP_WEB_SERVICE_KEY: string;
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
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const isPublicPath = url.pathname === "/unlock" || url.pathname === "/api/session" || url.pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(url.pathname);
    if (!isPublicPath) {
      const memberId = await verifySessionToken(readCookie(request, sessionCookieName), env.TRIP_SPACE_SESSION_SECRET);
      const member = memberId ? await env.DB.prepare("SELECT active FROM members WHERE id = ? LIMIT 1").bind(memberId).first<{ active: number }>() : null;
      if (!member?.active) return Response.redirect(new URL("/unlock", request.url), 302);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
