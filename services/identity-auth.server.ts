import { getRuntimeEnv } from "@/db";
import { createOpaqueSessionToken, sessionTokenDigest } from "@/services/session";

const encoder = new TextEncoder();
const iterationsPerRound = 100_000;
const rounds = 6;

function toBase64(bytes: Uint8Array) {
  let value = ""; for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
function fromBase64(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}
async function derive(password: string, salt: Uint8Array) {
  let material = encoder.encode(password);
  for (let round = 0; round < rounds; round += 1) {
    const roundSalt = new Uint8Array(salt.length + 1); roundSalt.set(salt); roundSalt[salt.length] = round;
    const key = await crypto.subtle.importKey("raw", material.buffer as ArrayBuffer, "PBKDF2", false, ["deriveBits"]);
    material = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: roundSalt.buffer as ArrayBuffer, iterations: iterationsPerRound }, key, 256));
  }
  return material;
}
function equal(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false; let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
export function validatePassword(password: string) {
  if (password.length < 10 || password.length > 128) throw new Error("INVALID_PASSWORD_LENGTH");
}
export async function credentialStatus(memberId: string) {
  try { return await getRuntimeEnv().DB.prepare("SELECT credential_status FROM members WHERE id = ? LIMIT 1").bind(memberId).first<{ credential_status: "legacy" | "active" | "disabled" }>(); }
  catch { return null; }
}
export async function activateCredential(memberId: string, password: string) {
  validatePassword(password);
  const salt = new Uint8Array(16); crypto.getRandomValues(salt);
  const digest = await derive(password, salt), now = new Date().toISOString(), db = getRuntimeEnv().DB;
  await db.batch([
    db.prepare("INSERT INTO member_credentials (member_id, algorithm, algorithm_version, salt, password_digest, updated_at) VALUES (?, 'pbkdf2-sha256-6x100k', 2, ?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET algorithm=excluded.algorithm, algorithm_version=excluded.algorithm_version, salt=excluded.salt, password_digest=excluded.password_digest, updated_at=excluded.updated_at").bind(memberId, toBase64(salt), toBase64(digest), now),
    db.prepare("UPDATE members SET credential_status = 'active', last_login_at = ? WHERE id = ?").bind(now, memberId),
    db.prepare("UPDATE member_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL").bind(now, memberId),
  ]);
}
export async function verifyPassword(memberId: string, password: string) {
  const row = await getRuntimeEnv().DB.prepare("SELECT algorithm, algorithm_version, salt, password_digest FROM member_credentials WHERE member_id = ? LIMIT 1").bind(memberId).first<{ algorithm: string; algorithm_version: number; salt: string; password_digest: string }>();
  if (!row || row.algorithm !== "pbkdf2-sha256-6x100k" || row.algorithm_version !== 2) return false;
  return equal(await derive(password, fromBase64(row.salt)), fromBase64(row.password_digest));
}
export async function issueServerSession(memberId: string, deviceSummary: string | null) {
  const token = await createOpaqueSessionToken(), now = new Date(), expires = new Date(now.getTime() + 30 * 86_400_000), id = crypto.randomUUID();
  await getRuntimeEnv().DB.prepare("INSERT INTO member_sessions (id, token_digest, member_id, device_summary, created_at, last_used_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)").bind(id, await sessionTokenDigest(token), memberId, deviceSummary?.slice(0, 180) || null, now.toISOString(), now.toISOString(), expires.toISOString()).run();
  return token;
}
export async function revokeSession(token: string | undefined, allForMember = false) {
  if (!token?.startsWith("v2.")) return;
  const db = getRuntimeEnv().DB, digest = await sessionTokenDigest(token), now = new Date().toISOString();
  if (allForMember) await db.prepare("UPDATE member_sessions SET revoked_at = ? WHERE member_id = (SELECT member_id FROM member_sessions WHERE token_digest = ?) AND revoked_at IS NULL").bind(now, digest).run();
  else await db.prepare("UPDATE member_sessions SET revoked_at = ? WHERE token_digest = ? AND revoked_at IS NULL").bind(now, digest).run();
}
export async function isAdminMember(memberId: string) {
  try { return Boolean((await getRuntimeEnv().DB.prepare("SELECT role FROM members WHERE id = ? AND active = 1 LIMIT 1").bind(memberId).first<{ role: string }>())?.role === "admin"); }
  catch { return false; }
}
