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

export function readCookie(request: Request, name: string) {
  const match = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
