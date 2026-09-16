import { getRuntimeEnv } from "@/db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const encoder = new TextEncoder();

async function digestKey(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Return the proxy-provided client address without persisting it directly. */
export function requestClientIdentifier(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    || "unknown";
  return forwarded.slice(0, 128);
}

/**
 * Atomically consume one counter slot in D1.  The counter stops at the limit
 * so repeated blocked requests cannot grow the row indefinitely.  A missing
 * table is intentionally an error: authentication/quota protection must not
 * silently fail open after a deployment that forgot its migration.
 */
export async function consumeRateLimit(namespace: string, identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error("INVALID_RATE_LIMIT_CONFIG");
  const env = getRuntimeEnv();
  if (!env.DB) throw new Error("RATE_LIMIT_STORAGE_UNAVAILABLE");
  const key = await digestKey(`${namespace}:${identifier}`);
  const now = Date.now();
  const cutoff = now - windowMs;
  const row = await env.DB.prepare(`
    INSERT INTO rate_limits (key, window_started_at, count)
    VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET
      window_started_at = CASE
        WHEN rate_limits.window_started_at <= ? THEN excluded.window_started_at
        ELSE rate_limits.window_started_at
      END,
      count = CASE
        WHEN rate_limits.window_started_at <= ? THEN 1
        WHEN rate_limits.count < ? THEN rate_limits.count + 1
        ELSE rate_limits.count
      END
    RETURNING count, window_started_at
  `).bind(key, now, cutoff, cutoff, limit).first<{ count: number; window_started_at: number }>();
  if (!row) throw new Error("RATE_LIMIT_COUNTER_FAILED");
  const retryAfterSeconds = Math.max(1, Math.ceil((Number(row.window_started_at) + windowMs - now) / 1000));
  const count = Number(row.count);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

export function rateLimitResponse(result: RateLimitResult, message = "请求过于频繁，请稍后再试。") {
  return Response.json({ error: message }, {
    status: 429,
    headers: {
      "cache-control": "no-store",
      "retry-after": String(result.retryAfterSeconds),
      "x-ratelimit-remaining": String(result.remaining),
    },
  });
}
