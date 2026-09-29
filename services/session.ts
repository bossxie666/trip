export const sessionCookieName = "trip_space_session";
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifySignature(value: string, supplied: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, base64UrlToBytes(supplied), encoder.encode(value));
}

export async function createSessionToken(memberId: string, secret: string) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ memberId, expiresAt: Date.now() + 30 * 86_400_000 })));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  try {
    if (!await verifySignature(payload, supplied, secret)) return null;
  } catch {
    return null;
  }
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { memberId?: string; expiresAt?: number };
    return decoded.memberId && decoded.expiresAt && decoded.expiresAt > Date.now() ? decoded.memberId : null;
  } catch { return null; }
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createOpaqueSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `v2.${bytesToBase64Url(bytes)}`;
}

export async function sessionTokenDigest(token: string) { return sha256(token); }

/** New opaque sessions are checked in D1. Signed legacy cookies remain valid
 * during the activation window and can be removed after every member migrates. */
export async function verifySessionMemberId(token: string | undefined, secret: string | undefined, db?: D1Database) {
  if (token?.startsWith("v2.") && db) {
    try {
      const now = new Date().toISOString();
      const digest = await sessionTokenDigest(token);
      const row = await db.prepare("SELECT member_id, last_used_at FROM member_sessions WHERE token_digest = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1").bind(digest, now).first<{ member_id: string; last_used_at: string }>();
      if (row && Date.now() - Date.parse(row.last_used_at) > 15 * 60_000) await db.prepare("UPDATE member_sessions SET last_used_at = ? WHERE token_digest = ?").bind(now, digest).run();
      return row?.member_id || null;
    } catch { return null; }
  }
  return verifySessionToken(token, secret);
}

export function readCookie(request: Request, name: string) {
  const match = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
