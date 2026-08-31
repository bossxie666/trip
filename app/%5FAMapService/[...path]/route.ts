import { getCurrentMember } from "@/services/auth.server";
import { getRuntimeEnv } from "@/db";

async function proxy(request: Request, paramsPromise: Promise<{ path: string[] }>) {
  if (!await getCurrentMember()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const jscode = getRuntimeEnv().AMAP_JS_SECURITY_CODE;
  if (!jscode) return Response.json({ error: "AMap is not configured" }, { status: 503 });
  const path = (await paramsPromise).path.join("/");
  if (!/^(v3|v4|v5)\//.test(path)) return Response.json({ error: "Unsupported AMap path" }, { status: 404 });
  const incoming = new URL(request.url), upstream = new URL(`https://restapi.amap.com/${path}`);
  incoming.searchParams.forEach((value, key) => { if (key !== "jscode") upstream.searchParams.append(key, value); });
  upstream.searchParams.set("jscode", jscode);
  const response = await fetch(upstream, { method: request.method, headers: { accept: request.headers.get("accept") || "application/json", ...(request.headers.get("content-type") ? { "content-type": request.headers.get("content-type")! } : {}) }, body: request.method === "POST" ? request.body : undefined, signal: AbortSignal.timeout(8_000) });
  const headers = new Headers(response.headers); headers.delete("set-cookie"); headers.set("cache-control", "private, max-age=60");
  return new Response(response.body, { status: response.status, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) { return proxy(request, params); }
export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) { return proxy(request, params); }
