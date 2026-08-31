import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

class TestD1Statement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new TestD1Statement(this.database, this.sql, values); }
  async all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values) }; }
  async raw() { const statement = this.database.prepare(this.sql); statement.setReturnArrays(true); return statement.all(...this.values); }
  async run() { const result = this.database.prepare(this.sql).run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }, results: [] }; }
  async first(column) { const row = (await this.all()).results[0] ?? null; return column && row ? row[column] : row; }
}

class TestD1Database {
  constructor() { this.database = new DatabaseSync(":memory:"); this.database.exec("PRAGMA foreign_keys = ON"); }
  prepare(sql) { return new TestD1Statement(this.database, sql); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.all()); return results; }
}

const DB = new TestD1Database();
globalThis.__TRIP_TEST_D1__ = DB;
globalThis.__TRIP_TEST_ENV__ = { TRIP_SPACE_INVITE_CODE: "test-invite", TRIP_SPACE_SESSION_SECRET: "test-session-secret-at-least-32-characters" };
for (const file of ["0000_strange_unus.sql", "0001_fancy_sharon_carter.sql"]) DB.database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));

let sessionCookie = "";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const body = init.body && typeof init.body !== "string" ? JSON.stringify(init.body) : init.body;
  const headers = { accept: "text/html", ...(body ? { "content-type": "application/json" } : {}), ...(sessionCookie ? { cookie: sessionCookie } : {}), ...init.headers };
  return worker.fetch(new Request(`http://localhost${pathname}`, { ...init, body, headers }), {
    DB, TRIP_SPACE_INVITE_CODE: "test-invite", TRIP_SPACE_SESSION_SECRET: "test-session-secret-at-least-32-characters", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

async function login() {
  const response = await render("/api/session", { method: "POST", body: { memberName: "nini", code: "test-invite" } });
  assert.equal(response.status, 200);
  sessionCookie = response.headers.get("set-cookie").split(";")[0];
}

await login();

async function createTrip(body) {
  const response = await render("/api/trips", { method: "POST", body });
  const payload = await response.json();
  assert.equal(response.status, 201, payload.error);
  return payload.trip;
}

test("keeps all Stage A routes available", async () => {
  const [home, cities, city, map] = await Promise.all([render(), render("/cities"), render("/cities/shanghai"), render("/map")]);
  assert.equal(home.status, 200); assert.match(await home.text(), /跳进地理书/);
  assert.equal(cities.status, 200); assert.equal(city.status, 200); assert.equal(map.status, 200);
});

test("filters the protected Shanghai Hangzhou trip correctly", async () => {
  const [all, planning, inspiration] = await Promise.all([render("/trips"), render("/trips?status=planning"), render("/trips?status=inspiration")]);
  assert.match(await all.text(), /上海 \+ 杭州/);
  assert.match(await planning.text(), /上海 \+ 杭州/);
  assert.doesNotMatch(await inspiration.text(), /上海 \+ 杭州/);
});

test("creates and persists inspiration and planning trips", async () => {
  const inspirationTrip = await createTrip({ title: "日本关西", status: "inspiration", cities: ["大阪", "京都", "奈良"], undated: true, people: 2 });
  const planningTrip = await createTrip({ title: "Tokyo Spring", status: "planning", cities: ["东京"], startDate: "2027-04-02", endDate: "2027-04-04", people: 1 });
  assert.match(inspirationTrip.slug, /^trip-undated-[a-z0-9]+$/);
  assert.match(planningTrip.slug, /^tokyo-spring-2027$/);
  const [inspirationPage, planningPage, allAfterRefresh] = await Promise.all([render("/trips?status=inspiration"), render("/trips?status=planning"), render("/trips")]);
  assert.match(await inspirationPage.text(), /日本关西/);
  assert.match(await planningPage.text(), /Tokyo Spring/);
  assert.match(await allAfterRefresh.text(), /日本关西/);
  const genericDetail = await render(`/trips/${planningTrip.slug}`);
  const detailHtml = await genericDetail.text();
  assert.equal(genericDetail.status, 200);
  assert.match(detailHtml, /Tokyo Spring/); assert.match(detailHtml, /Day 1/); assert.match(detailHtml, /Day 3/); assert.match(detailHtml, /地图位置已预留/);
});

test("avoids duplicate slugs", async () => {
  const duplicate = await createTrip({ title: "Tokyo Spring", status: "planning", cities: ["东京"], startDate: "2027-04-10", endDate: "2027-04-10", people: 1 });
  assert.equal(duplicate.slug, "tokyo-spring-2027-2");
});

test("returns a normal Not Found page for an unknown trip", async () => {
  const response = await render("/trips/does-not-exist");
  assert.equal(response.status, 404); assert.match(await response.text(), /没有找到这条行程/);
});

test("keeps the frozen Shanghai Hangzhou detail unchanged", async () => {
  const response = await render("/trips/shanghai-hangzhou-2026");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /上海＋杭州/); assert.match(html, /我的个人消费/); assert.match(html, /同行人自助计算/); assert.match(html, /杭州东与杭州南/);
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton/);
});

test("requires a member session and supports collaborative edit and delete", async () => {
  const saved = sessionCookie; sessionCookie = "";
  const anonymous = await render("/trips"); assert.equal(anonymous.status, 302); assert.match(anonymous.headers.get("location"), /\/unlock$/);
  sessionCookie = saved;
  const trip = await createTrip({ title: "朋友旅行", status: "planning", cities: ["苏州"], undated: true, people: 2, memberIds: ["member-zhu-jingqi"] });
  const update = await render(`/api/trips/${trip.slug}`, { method: "PUT", body: { title: "朋友旅行更新", status: "completed", cities: ["苏州", "无锡"], undated: true, people: 2, memberIds: ["member-zhu-jingqi"] } });
  assert.equal(update.status, 200); assert.equal((await update.json()).trip.status, "completed");
  const remove = await render(`/api/trips/${trip.slug}`, { method: "DELETE" }); assert.equal(remove.status, 200);
  const protectedRemove = await render("/api/trips/shanghai-hangzhou-2026", { method: "DELETE" }); assert.equal(protectedRemove.status, 403);
});
