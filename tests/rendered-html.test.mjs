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
  async batch(statements) { this.database.exec("BEGIN IMMEDIATE"); try { const results = []; for (const statement of statements) results.push(await statement.all()); this.database.exec("COMMIT"); return results; } catch (error) { this.database.exec("ROLLBACK"); throw error; } }
}

const DB = new TestD1Database();
globalThis.__TRIP_TEST_D1__ = DB;
globalThis.__TRIP_TEST_ENV__ = { TRIP_SPACE_INVITE_CODE: "test-invite", TRIP_SPACE_SESSION_SECRET: "test-session-secret-at-least-32-characters", AMAP_JS_API_KEY: "test-js-key", AMAP_JS_SECURITY_CODE: "test-js-code", AMAP_WEB_SERVICE_KEY: "test-web-key" };
for (const file of ["0000_strange_unus.sql", "0001_fancy_sharon_carter.sql", "0002_cynical_umar.sql", "0003_bright_prodigy.sql", "0004_clean_starfox.sql", "0005_omniscient_la_nuit.sql", "0006_right_queen_noir.sql"]) DB.database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
  if (url.hostname !== "restapi.amap.com") return nativeFetch(input, init);
  if (url.pathname === "/v5/place/text") return Response.json({ status: "1", infocode: "10000", pois: [{ id: "B0TESTBUND", name: "测试外滩", address: "中山东一路", location: "121.490317,31.241701", adcode: "310101", citycode: "021", adname: "黄浦区", typecode: "110202" }] });
  if (url.pathname === "/v5/place/detail") return Response.json({ status: "1", infocode: "10000", pois: [{ id: url.searchParams.get("id"), name: "测试外滩", address: "中山东一路", location: "121.490317,31.241701", adcode: "310101", citycode: "021", adname: "黄浦区", typecode: "110202" }] });
  if (url.pathname === "/v3/geocode/geo") return Response.json({ status: "1", infocode: "10000", geocodes: [{ formatted_address: "上海市黄浦区中山东一路", location: "121.490317,31.241701", adcode: "310101", citycode: "021", district: "黄浦区" }] });
  if (url.pathname.startsWith("/v5/direction/")) return Response.json({ status: "1", infocode: "10000", route: { paths: [{ distance: "1200", cost: { duration: "900" }, steps: [{ polyline: "121.490317,31.241701;121.500000,31.250000" }] }] } });
  return Response.json({ status: "0", infocode: "10002" });
};

let sessionCookie = "";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const body = init.body && typeof init.body !== "string" ? JSON.stringify(init.body) : init.body;
  const headers = { accept: "text/html", ...(body ? { "content-type": "application/json" } : {}), ...(sessionCookie ? { cookie: sessionCookie } : {}), ...init.headers };
  return worker.fetch(new Request(`http://localhost${pathname}`, { ...init, body, headers }), {
    DB, TRIP_SPACE_INVITE_CODE: "test-invite", TRIP_SPACE_SESSION_SECRET: "test-session-secret-at-least-32-characters", AMAP_JS_API_KEY: "test-js-key", AMAP_JS_SECURITY_CODE: "test-js-code", AMAP_WEB_SERVICE_KEY: "test-web-key", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
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
  const allHtml = await all.text();
  assert.match(allHtml, /上海 \+ 杭州/);
  assert.match(allHtml, /<a[^>]+href="\/"[^>]*>返回首页<\/a>/);
  assert.match(allHtml, /<a[^>]+href="\/trips\/new"[^>]*>＋ 新建行程<\/a>/);
  assert.match(allHtml, /<a[^>]+href="\/trips\?status=inspiration"/);
  assert.match(allHtml, /<a[^>]+href="\/trips\/shanghai-hangzhou-2026"/);
  assert.match(await planning.text(), /上海 \+ 杭州/);
  assert.doesNotMatch(await inspiration.text(), /上海 \+ 杭州/);
});

test("hydrates Shanghai Hangzhou from D1 with stage participation and candidate places", async () => {
  const trip = DB.database.prepare("SELECT id, slug, title, status, start_date, end_date, people, protected FROM trips WHERE slug = ?").get("shanghai-hangzhou-2026");
  assert.deepEqual({ ...trip }, { id: "trip-shanghai-hangzhou-2026", slug: "shanghai-hangzhou-2026", title: "上海 + 杭州", status: "planning", start_date: "2026-09-23", end_date: "2026-09-24", people: 4, protected: 1 });
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trip_members WHERE trip_id = ?").get(trip.id).count, 5);
  const stageCounts = DB.database.prepare("SELECT s.title, count(sm.member_id) AS members FROM trip_stages s LEFT JOIN trip_stage_members sm ON sm.stage_id = s.id WHERE s.trip_id = ? GROUP BY s.id ORDER BY s.sort_order").all(trip.id);
  assert.deepEqual(stageCounts.map((stage) => ({ ...stage })), [{ title: "上海阶段", members: 4 }, { title: "杭州阶段", members: 5 }]);
  const stageMembers = DB.database.prepare("SELECT s.title, sm.member_id FROM trip_stages s INNER JOIN trip_stage_members sm ON sm.stage_id = s.id WHERE s.trip_id = ? ORDER BY s.sort_order, sm.member_id").all(trip.id);
  assert.deepEqual(stageMembers.map((stage) => ({ ...stage })), [
    { title: "上海阶段", member_id: "member-liu-xu" },
    { title: "上海阶段", member_id: "member-nini" },
    { title: "上海阶段", member_id: "member-sun-yan" },
    { title: "上海阶段", member_id: "member-wang-jingwen" },
    { title: "杭州阶段", member_id: "member-liu-xu" },
    { title: "杭州阶段", member_id: "member-nini" },
    { title: "杭州阶段", member_id: "member-sun-yan" },
    { title: "杭州阶段", member_id: "member-wang-jingwen" },
    { title: "杭州阶段", member_id: "member-zhu-jingqi" },
  ]);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trip_places WHERE trip_id = ? AND plan_status = 'candidate'").get(trip.id).count, 6);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trip_places WHERE trip_id = ? AND plan_status != 'candidate'").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM places WHERE id IN ('place-pvg-t2','place-shanghai-south','place-shanghai-disney','place-oriental-pearl','place-the-bund','place-hangzhou-east') AND coordinate_system = 'GCJ02' AND latitude IS NOT NULL AND longitude IS NOT NULL").get().count, 6);
  const page = await render("/trips");
  assert.match(await page.text(), /上海4人 · 杭州5人/);
  const detail = await render("/trips/shanghai-hangzhou-2026");
  assert.equal(detail.status, 200);
  const detailHtml = await detail.text();
  assert.match(detailHtml, /地图地点读取自这趟旅行的 Day \/ Place 数据/);
  assert.match(detailHtml, /高德真实地图/);
  assert.match(detailHtml, /详细离线图/);
  assert.match(detailHtml, /上海→杭州铁路候选预算/);
  assert.match(detailHtml, /2 DAYS · SHANGHAI 4 · HANGZHOU 5/);
  assert.doesNotMatch(detailHtml, /简单方位图/);
  assert.doesNotMatch(detailHtml, /active-candidate/);
});

test("scopes the Shanghai Hangzhou AMap to its active Stage and reruns fitView after loading", () => {
  const adapter = readFileSync(new URL("../components/trip/ShanghaiHangzhouMapDesk.tsx", import.meta.url), "utf8");
  const map = readFileSync(new URL("../components/trip/GenericTripMap.tsx", import.meta.url), "utf8");
  assert.match(adapter, /currentStage = initial\.stages\.find/);
  assert.match(adapter, /day\.places\.filter\(\(item\) => item\.place\.cityId === activeCityId\)/);
  assert.match(adapter, /杭州: \[120\.1551, 30\.2741\]/);
  assert.match(map, /setMapReady\(true\)/);
  assert.match(map, /\[allPlaces, mapReady, route\]/);
  assert.match(map, /place\.planStatus === "candidate" \? 0\.48 : 1/);
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
  assert.match(detailHtml, /Tokyo Spring/); assert.match(detailHtml, /Day/); assert.match(detailHtml, /高德地点/); assert.match(detailHtml, /规划路线/);
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
  const anonymous = await render("/trips?status=planning"); assert.equal(anonymous.status, 302); assert.equal(new URL(anonymous.headers.get("location")).searchParams.get("returnTo"), "/trips?status=planning");
  const anonymousRoot = await render("/"); assert.equal(new URL(anonymousRoot.headers.get("location")).searchParams.get("returnTo"), "/");
  const anonymousDeep = await render("/trips/shanghai-hangzhou-2026"); assert.equal(new URL(anonymousDeep.headers.get("location")).searchParams.get("returnTo"), "/trips/shanghai-hangzhou-2026");
  const unlock = await render("/unlock?returnTo=https://evil.example/phish"); assert.equal(unlock.status, 200); const unlockHtml = await unlock.text(); assert.equal(unlockHtml.match(/evil\.example/g)?.length, 1);
  sessionCookie = saved;
  const trip = await createTrip({ title: "朋友旅行", status: "planning", cities: ["苏州"], undated: true, people: 2, memberIds: ["member-zhu-jingqi"] });
  const update = await render(`/api/trips/${trip.slug}`, { method: "PUT", body: { title: "朋友旅行更新", status: "completed", cities: ["苏州", "无锡"], undated: true, people: 2, memberIds: ["member-zhu-jingqi"] } });
  assert.equal(update.status, 200); assert.equal((await update.json()).trip.status, "completed");
  const remove = await render(`/api/trips/${trip.slug}`, { method: "DELETE" }); assert.equal(remove.status, 200);
  const protectedRemove = await render("/api/trips/shanghai-hangzhou-2026", { method: "DELETE" }); assert.equal(protectedRemove.status, 403);
});

test("creates reusable places and keeps stable Day ordering", async () => {
  const tripA = await createTrip({ title: "关西地点测试", status: "planning", cities: ["大阪"], startDate: "2027-05-01", endDate: "2027-05-01", people: 2, memberIds: [] });
  const tripB = await createTrip({ title: "大阪重游", status: "planning", cities: ["大阪"], startDate: "2028-05-01", endDate: "2028-05-01", people: 1, memberIds: [] });
  const workspaceA = (await (await render(`/api/trips/${tripA.slug}/places`)).json()).workspace;
  const dayA = workspaceA.days[0].id, cityId = workspaceA.cities[0].id;
  const first = await render(`/api/trips/${tripA.slug}/places`, { method: "POST", body: { action: "create", dayId: dayA, name: "大阪城", cityId, address: "大阪市中央区" } });
  assert.equal(first.status, 201); const firstWorkspace = (await first.json()).workspace; const osakaCastle = firstWorkspace.days[0].places[0].place;
  const second = await render(`/api/trips/${tripA.slug}/places`, { method: "POST", body: { action: "create", dayId: dayA, name: "道顿堀", cityId } });
  assert.equal(second.status, 201); const secondWorkspace = (await second.json()).workspace; const dotonbori = secondWorkspace.days[0].places[1].place;
  const reordered = await render(`/api/trips/${tripA.slug}/places`, { method: "PATCH", body: { dayId: dayA, orderedPlaceIds: [dotonbori.id, osakaCastle.id] } });
  assert.equal(reordered.status, 200); assert.deepEqual((await reordered.json()).workspace.days[0].places.map((item) => item.place.name), ["道顿堀", "大阪城"]);
  const refreshed = (await (await render(`/api/trips/${tripA.slug}/places`)).json()).workspace;
  assert.deepEqual(refreshed.days[0].places.map((item) => [item.sortOrder, item.place.name]), [[1, "道顿堀"], [2, "大阪城"]]);
  const workspaceB = (await (await render(`/api/trips/${tripB.slug}/places`)).json()).workspace;
  assert.ok(workspaceB.availablePlaces.some((place) => place.id === osakaCastle.id));
  const reused = await render(`/api/trips/${tripB.slug}/places`, { method: "POST", body: { action: "existing", dayId: workspaceB.days[0].id, placeId: osakaCastle.id } }); assert.equal(reused.status, 201);
  const creator = DB.database.prepare("SELECT created_by_member_id, updated_by_member_id FROM places WHERE id = ?").get(osakaCastle.id); assert.equal(creator.created_by_member_id, "member-nini"); assert.equal(creator.updated_by_member_id, "member-nini");
  const removed = await render(`/api/trips/${tripA.slug}/places?dayId=${dayA}&placeId=${dotonbori.id}`, { method: "DELETE" }); assert.equal(removed.status, 200);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM places WHERE id = ?").get(dotonbori.id).count, 1);
  const deleteTripB = await render(`/api/trips/${tripB.slug}`, { method: "DELETE" }); assert.equal(deleteTripB.status, 200);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM places WHERE id = ?").get(osakaCastle.id).count, 1);
});

test("denies anonymous Place writes and preserves seeded members and shadow places", async () => {
  const saved = sessionCookie; sessionCookie = "";
  const denied = await render("/api/trips/anything/places", { method: "POST", body: { action: "create" } }); assert.equal(denied.status, 302);
  sessionCookie = saved;
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM members").get().count, 5);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM places WHERE id LIKE 'place-%'").get().count >= 6, true);
});

test("searches AMap POIs, persists GCJ-02 data, and plans a Day route", async () => {
  const trip = await createTrip({ title: "高德地图测试", status: "planning", cities: ["上海"], startDate: "2027-06-01", endDate: "2027-06-01", people: 2, memberIds: [] });
  const workspace = (await (await render(`/api/trips/${trip.slug}/places`)).json()).workspace, dayId = workspace.days[0].id, cityId = workspace.cities[0].id;
  const search = await render(`/api/amap/places/search?keywords=${encodeURIComponent("外滩")}&cityId=${cityId}`, { headers: { accept: "application/json" } });
  assert.equal(search.status, 200); const poi = (await search.json()).pois[0]; assert.equal(poi.id, "B0TESTBUND");
  const saved = await render(`/api/trips/${trip.slug}/places`, { method: "POST", body: { action: "create-amap", dayId, cityId, providerPlaceId: poi.id } });
  assert.equal(saved.status, 201); const place = (await saved.json()).workspace.days[0].places[0].place;
  assert.equal(place.provider, "amap"); assert.equal(place.coordinateSystem, "GCJ02"); assert.equal(place.providerPlaceId, poi.id); assert.equal(place.adcode, "310101");
  const manual = await render(`/api/trips/${trip.slug}/places`, { method: "POST", body: { action: "create", dayId, cityId, name: "测试终点" } });
  const destination = (await manual.json()).workspace.days[0].places[1].place;
  DB.database.prepare("UPDATE places SET longitude = ?, latitude = ?, coordinate_system = 'GCJ02' WHERE id = ?").run(121.5, 31.25, destination.id);
  const route = await render("/api/amap/routes", { method: "POST", body: { slug: trip.slug, originPlaceId: place.id, destinationPlaceId: destination.id, mode: "walking" } });
  assert.equal(route.status, 200); const planned = (await route.json()).route; assert.equal(planned.distanceMeters, 1200); assert.equal(planned.durationSeconds, 900); assert.equal(planned.polylines.length, 1);
  const config = await render("/api/amap/config", { headers: { accept: "application/json" } }); assert.equal(config.status, 200); const configBody = await config.json(); assert.equal(configBody.key, "test-js-key"); assert.match(configBody.serviceHost, /\/_AMapService$/);
  const geocode = await render("/api/amap/geocode", { method: "POST", body: { address: "中山东一路", cityId } }); assert.equal(geocode.status, 200); assert.equal((await geocode.json()).result.coordinateSystem, "GCJ02");
});
