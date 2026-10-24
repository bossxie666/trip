import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { assertImageSignature, readUploadBody } from "../services/media-upload-validation.ts";

test("checks image bytes for the supported formats, including iPhone HEIF containers", () => {
  const signature = (text) => Uint8Array.from(Buffer.from(text, "hex"));
  assert.doesNotThrow(() => assertImageSignature("image/jpeg", signature("ffd8ffe0")));
  assert.doesNotThrow(() => assertImageSignature("image/png", signature("89504e470d0a1a0a")));
  assert.doesNotThrow(() => assertImageSignature("image/webp", Buffer.from("RIFF1234WEBPVP8L")));
  for (const brand of ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]) {
    const bytes = Buffer.alloc(24); bytes.writeUInt32BE(24); bytes.write("ftyp" + brand, 4);
    for (const type of ["image/heic", "image/heif"]) assert.doesNotThrow(() => assertImageSignature(type, bytes));
  }
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
    assert.throws(() => assertImageSignature(type, Buffer.from("<html>not a photo</html>")), /MEDIA_UPLOAD_INVALID_TYPE/);
    assert.throws(() => assertImageSignature(type, new Uint8Array()), /MEDIA_UPLOAD_INVALID_TYPE/);
  }
  const mp4 = Buffer.alloc(24); mp4.writeUInt32BE(24); mp4.write("ftypmp42", 4);
  assert.throws(() => assertImageSignature("image/heic", mp4), /MEDIA_UPLOAD_INVALID_TYPE/);
  mp4.write("avif", 8);
  assert.throws(() => assertImageSignature("image/heif", mp4), /MEDIA_UPLOAD_INVALID_TYPE/);
  assert.throws(() => assertImageSignature("image/png", signature("ffd8ffe0")), /MEDIA_UPLOAD_INVALID_TYPE/);
});

test("bounds chunked upload reads independently of a missing or dishonest length header", async () => {
  for (const length of [null, "1"]) {
    let cancelled = false;
    let reads = 0;
    const stream = new ReadableStream({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(7)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const request = new Request("http://localhost/upload", { method: "PUT", body: stream, duplex: "half", ...(length ? { headers: { "content-length": length } } : {}) });
    await assert.rejects(readUploadBody(request, 10), /MEDIA_UPLOAD_TOO_LARGE/);
    assert.equal(cancelled, true); assert.equal(reads, 2);
  }
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(readUploadBody(new Request("http://localhost/upload", { method: "PUT", body: stream, duplex: "half", headers: { "content-length": "11" } }), 10), /MEDIA_UPLOAD_TOO_LARGE/);
  assert.equal(cancelled, true);
  assert.deepEqual(new Uint8Array(await readUploadBody(new Request("http://localhost/upload", { method: "PUT", body: new Uint8Array([1, 2, 3]) }), 3)), new Uint8Array([1, 2, 3]));
});

// An isolated in-memory service test, not a local login/DB/R2 preview stack.
class Statement {
  constructor(database, sql, values = []) { Object.assign(this, { database, sql, values }); }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  async all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values) }; }
  async raw() { const statement = this.database.prepare(this.sql); statement.setReturnArrays(true); return statement.all(...this.values); }
  async run() { const result = this.database.prepare(this.sql).run(...this.values); return { success: true, meta: { changes: Number(result.changes) }, results: [] }; }
  async first(column) { const row = (await this.all()).results[0] ?? null; return column && row ? row[column] : row; }
}
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
const DB = {
  prepare: (sql) => new Statement(sqlite, sql),
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.all()); return results; },
};
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => /^\d{4}.*\.sql$/.test(name)).sort()) sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
const objects = new Map();
let prefixReads = 0;
let replaceBeforePrefix = false;
const MEDIA = {
  async put(key, input, options) { const bytes = Uint8Array.from(new Uint8Array(input)); objects.set(key, { bytes, size: bytes.byteLength, etag: crypto.randomUUID(), httpMetadata: options?.httpMetadata }); },
  async head(key) { const object = objects.get(key); return object ? { size: object.size, etag: object.etag, httpMetadata: object.httpMetadata } : null; },
  async get(key, options) {
    const object = objects.get(key); if (!object) return null;
    if (replaceBeforePrefix) { object.etag = crypto.randomUUID(); replaceBeforePrefix = false; }
    if (options?.onlyIf?.etagMatches !== object.etag) return { size: object.size, etag: object.etag };
    assert.equal(options.range.offset, 0); assert.ok(options.range.length <= 64); prefixReads++;
    const prefix = object.bytes.slice(0, options.range.length);
    return { size: object.size, etag: object.etag, body: new Response(prefix).body, arrayBuffer: async () => prefix.buffer };
  },
};
const env = { DB, MEDIA, TRIP_SPACE_INVITE_CODE: "test-invite", TRIP_SPACE_SESSION_SECRET: "test-session-secret-at-least-32-characters", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
globalThis.__TRIP_TEST_D1__ = DB;
globalThis.__TRIP_TEST_ENV__ = env;
const { default: worker } = await import("../dist/server/index.js");
let cookie = "";
async function call(path, { method = "GET", body, headers = {} } = {}) {
  return worker.fetch(new Request(`http://localhost${path}`, { method, body, headers: { accept: "application/json", ...(cookie ? { cookie } : {}), ...headers } }), env, { waitUntil() {}, passThroughOnException() {} });
}
async function json(path, body) { return call(path, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }); }
async function login(name) {
  const response = await json("/api/session", { memberName: name, code: "test-invite" });
  assert.equal(response.status, 200); cookie = response.headers.get("set-cookie").split(";")[0];
}
await login("nini");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");
async function authorize(bytes) {
  const response = await json("/api/media/uploads", { purpose: "album", filename: "image.png", contentType: "image/png", byteSize: bytes.byteLength });
  assert.equal(response.status, 201); return response.json();
}

test("returns controlled 400s for malformed upload authorization, not internal 500s", async () => {
  for (const body of [null, [], { purpose: "album", filename: 12, contentType: "image/png", byteSize: 12 }]) assert.equal((await json("/api/media/uploads", body)).status, 400);
  assert.equal((await call("/api/media/uploads", { method: "POST", body: "{", headers: { "content-type": "application/json" } })).status, 400);
});

test("worker fallback uploads and completes a real PNG, preserving idempotent completion", async () => {
  const upload = await authorize(png);
  assert.equal(upload.uploadMode, "worker");
  assert.equal((await call(upload.uploadUrl, { method: "PUT", body: png, headers: upload.headers })).status, 200);
  const complete = await json(`/api/media/uploads/${upload.assetId}/complete`, { width: 1, height: 1 });
  assert.equal(complete.status, 200); assert.equal((await complete.json()).asset.status, "ready");
  assert.equal(sqlite.prepare("SELECT status FROM media_assets WHERE id=?").get(upload.assetId).status, "ready");
  const reads = prefixReads;
  assert.equal((await json(`/api/media/uploads/${upload.assetId}/complete`, {})).status, 200);
  assert.equal(prefixReads, reads);
});

test("rejects MIME spoofing before a Worker PUT writes any object", async () => {
  const fake = Buffer.from("<html>not a PNG</html>");
  const upload = await authorize(fake); const count = objects.size;
  assert.equal((await call(upload.uploadUrl, { method: "PUT", body: fake, headers: upload.headers })).status, 400);
  assert.equal(objects.size, count);
  assert.equal(sqlite.prepare("SELECT status FROM media_assets WHERE id=?").get(upload.assetId).status, "pending");
});

test("returns 413 for an oversized Worker request before storing any bytes", async () => {
  const upload = await authorize(png); const before = objects.size;
  const response = await call(upload.uploadUrl, { method: "PUT", body: png, headers: { ...upload.headers, "content-length": String(10 * 1024 * 1024 + 1) } });
  assert.equal(response.status, 413); assert.equal(objects.size, before);
});

test("validates the direct R2 completion path as well, without copying/deleting objects", async () => {
  for (const [bytes, expected] of [[png, 200], [Buffer.from("<html>not a photo</html>"), 400]]) {
    const upload = await authorize(bytes);
    const asset = sqlite.prepare("SELECT object_key FROM media_assets WHERE id=?").get(upload.assetId);
    await MEDIA.put(asset.object_key, bytes, { httpMetadata: { contentType: "image/png" } });
    const before = objects.size;
    assert.equal((await json(`/api/media/uploads/${upload.assetId}/complete`, {})).status, expected);
    assert.equal(objects.size, before);
    assert.equal(sqlite.prepare("SELECT status FROM media_assets WHERE id=?").get(upload.assetId).status, expected === 200 ? "ready" : "pending");
  }
});

test("keeps pending uploads private to the authorizing member", async () => {
  const upload = await authorize(png); const before = objects.size;
  try {
    await login("刘徐");
    assert.equal((await call(upload.uploadUrl, { method: "PUT", body: png, headers: upload.headers })).status, 404);
    assert.equal((await json(`/api/media/uploads/${upload.assetId}/complete`, {})).status, 404);
    assert.equal(objects.size, before);
  } finally { await login("nini"); }
});

test("does not mark a changed R2 object ready between HEAD and prefix validation", async () => {
  const upload = await authorize(png);
  const asset = sqlite.prepare("SELECT object_key FROM media_assets WHERE id=?").get(upload.assetId);
  await MEDIA.put(asset.object_key, png, { httpMetadata: { contentType: "image/png" } });
  replaceBeforePrefix = true;
  assert.equal((await json(`/api/media/uploads/${upload.assetId}/complete`, {})).status, 409);
  assert.equal(sqlite.prepare("SELECT status FROM media_assets WHERE id=?").get(upload.assetId).status, "pending");
});
