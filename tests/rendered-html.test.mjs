import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildIdentitySwitchReturnTo } from "../services/identity-navigation.ts";

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
for (const file of ["0000_strange_unus.sql", "0001_fancy_sharon_carter.sql", "0002_cynical_umar.sql", "0003_bright_prodigy.sql", "0004_clean_starfox.sql", "0005_omniscient_la_nuit.sql", "0006_right_queen_noir.sql", "0007_shanghai_hangzhou_real_trip.sql", "0008_fair_shinobi_shaw.sql", "0009_supreme_loa.sql", "0010_retire_shanghai_legacy.sql", "0011_v2_1_stability.sql", "0012_rename_zhu_jingqi_display_name.sql", "0013_absurd_bastion.sql", "0014_v2_2_1_confirmed_facts.sql", "0015_v2_4_r1_booking_endpoint_labels.sql"]) DB.database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
  if (url.hostname !== "restapi.amap.com") return nativeFetch(input, init);
  if (url.pathname === "/v5/place/text") return Response.json({ status: "1", infocode: "10000", pois: [{ id: "B0TESTBUND", name: "测试外滩", address: "中山东一路", location: "121.490317,31.241701", adcode: "310101", citycode: "021", adname: "黄浦区", typecode: "110202" }] });
  if (url.pathname === "/v5/place/detail") {
    const id = url.searchParams.get("id");
    return Response.json({ status: "1", infocode: "10000", pois: [{ id, name: id === "B0TESTHANGZHOU" ? "测试杭州酒店" : "测试外滩", address: id === "B0TESTHANGZHOU" ? "杭州市上城区" : "中山东一路", location: id === "B0TESTHANGZHOU" ? "120.182860,30.243482" : "121.490317,31.241701", adcode: id === "B0TESTHANGZHOU" ? "330102" : "310101", citycode: id === "B0TESTHANGZHOU" ? "0571" : "021", adname: id === "B0TESTHANGZHOU" ? "上城区" : "黄浦区", typecode: "110202" }] });
  }
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

async function loginAs(memberName) {
  const response = await render("/api/session", { method: "POST", body: { memberName, code: "test-invite" } });
  assert.equal(response.status, 200);
  sessionCookie = response.headers.get("set-cookie").split(";")[0];
}

await login();

test("renames Zhu Jingqi's login and display labels without changing identity or relations", async () => {
  const member = DB.database.prepare("SELECT id, name, display_name FROM members WHERE id = 'member-zhu-jingqi'").get();
  assert.deepEqual({ ...member }, { id: "member-zhu-jingqi", name: "kiki", display_name: "kiki" });
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trip_members WHERE member_id = 'member-zhu-jingqi'").get().count, 1);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trip_stage_members WHERE member_id = 'member-zhu-jingqi'").get().count, 1);
  const response = await render("/api/session", { method: "POST", body: { memberName: "kiki", code: "test-invite" } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).member, { id: "member-zhu-jingqi", displayName: "kiki" });
  const plan = await render("/trips/shanghai-hangzhou-2026/plan?view=planning");
  const planHtml = await plan.text();
  assert.match(planHtml, /kiki/);
  assert.doesNotMatch(planHtml, /朱婧琪/);
});

test("keeps Session Member separate from Member View and safely resets view on identity switch", async () => {
  const savedSession = sessionCookie;
  try {
    await loginAs("nini");
    const viewedWang = await render("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1&member=member-wang-jingwen");
    assert.equal(viewedWang.status, 200);
    const viewedWangHtml = await viewedWang.text();
    assert.match(viewedWangHtml, /当前身份/);
    assert.match(viewedWangHtml, /nini/);
    assert.match(viewedWangHtml, /成员视角/);
    assert.match(viewedWangHtml, /王静雯/);
    assert.equal(buildIdentitySwitchReturnTo("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1&member=member-wang-jingwen"), "/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1");

    const cleared = await render("/api/session", { method: "DELETE", headers: { accept: "application/json" } });
    assert.equal(cleared.status, 200);
    sessionCookie = "";
    const denied = await render("/trips/shanghai-hangzhou-2026/plan?view=map&day=trip-shanghai-hangzhou-2026-day-2");
    assert.equal(denied.status, 302);
    assert.equal(new URL(denied.headers.get("location")).searchParams.get("returnTo"), "/trips/shanghai-hangzhou-2026/plan?view=map&day=trip-shanghai-hangzhou-2026-day-2");

    await loginAs("刘徐");
    const switched = await render("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1");
    const switchedHtml = await switched.text();
    assert.match(switchedHtml, /当前身份[\s\S]{0,120}刘徐/);
    assert.match(switchedHtml, /<a class="active"[^>]+member=member-liu-xu[^>]*>刘徐<\/a>/);

    const viewedAgain = await render("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1&member=member-wang-jingwen");
    const viewedAgainHtml = await viewedAgain.text();
    assert.match(viewedAgainHtml, /当前身份[\s\S]{0,120}刘徐/);
    assert.match(viewedAgainHtml, /<a class="active"[^>]+member=member-wang-jingwen[^>]*>王静雯<\/a>/);

    const loggedOut = await render("/api/session", { method: "DELETE", headers: { accept: "application/json" } });
    assert.equal(loggedOut.status, 200);
    sessionCookie = "";
    const protectedAfterLogout = await render("/trips");
    assert.equal(protectedAfterLogout.status, 302);
    assert.equal(new URL(protectedAfterLogout.headers.get("location")).searchParams.get("returnTo"), "/trips");
  } finally {
    sessionCookie = savedSession;
  }
});

test("renders the identity control on the archive and workspace shells", async () => {
  await loginAs("nini");
  const tripsHtml = await (await render("/trips")).text();
  assert.match(tripsHtml, /class="member-identity-trigger"/);
  assert.match(tripsHtml, /aria-haspopup="menu"/);
  const planHtml = await (await render("/trips/shanghai-hangzhou-2026/plan?view=map")).text();
  assert.match(planHtml, /class="member-identity-trigger"/);
  assert.match(planHtml, /当前身份/);
});

test("keeps V2.4-R1 primary actions, page scrolling, and main editor ownership consistent", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const accommodation = readFileSync(new URL("../components/trip/BookingCreateControl.tsx", import.meta.url), "utf8");
  const transport = readFileSync(new URL("../components/trip/PlanAddControl.tsx", import.meta.url), "utf8");
  const presence = readFileSync(new URL("../components/trip/DayPresenceControl.tsx", import.meta.url), "utf8");
  const placeDiscovery = readFileSync(new URL("../components/trip/PlaceDiscoveryControl.tsx", import.meta.url), "utf8");
  const bookingEdit = readFileSync(new URL("../components/trip/BookingEditControl.tsx", import.meta.url), "utf8");
  const overlay = readFileSync(new URL("../components/trip/WorkspaceOverlay.tsx", import.meta.url), "utf8");

  assert.match(css, /\.plan-columns\{height:auto;min-height:0\}/);
  assert.match(css, /\.recommendation-panel,\.itinerary-panel\{overflow:visible;max-height:none\}/);
  assert.match(css, /\.booking-add-button\{[^}]*background:var\(--ink\);[^}]*color:#fff/);
  assert.match(css, /\.add-itinerary-button\{[^}]*background:var\(--ink\);[^}]*color:#fff/);
  assert.match(css, /\.workspace-overlay\{position:fixed;inset:0/);
  assert.match(css, /\.workspace-drawer\{width:min\(520px,100%\);height:100%/);
  assert.match(css, /\.button-primary\{border:1px solid var\(--ink\);background:var\(--ink\);color:#fff/);
  assert.doesNotMatch(accommodation, /添加长途交通/);
  assert.match(transport, /modalOwner = `plan-add:\$\{slug\}`/);
  assert.match(transport, /添加到 \{targetDayLabel\}/);
  assert.match(transport, /想把什么加入今天/);
  assert.match(transport, /交通会作为两个地点之间的路线 Edge/);
  assert.doesNotMatch(transport, /公共交通/);
  assert.match(presence, /modalOwner = `presence:\$\{slug\}:\$\{dayId\}`/);
  assert.match(placeDiscovery, /modalOwner = `place-discovery:\$\{slug\}`/);
  assert.match(bookingEdit, /modalName = `booking-editor:\$\{booking\.id\}`/);
  assert.match(accommodation, /WorkspaceOverlay/);
  assert.match(accommodation, /mode="drawer"/);
  assert.match(transport, /WorkspaceOverlay/);
  assert.match(presence, /WorkspaceOverlay/);
  assert.match(placeDiscovery, /WorkspaceOverlay/);
  assert.match(bookingEdit, /WorkspaceOverlay/);
  assert.match(bookingEdit, /mode="drawer"/);
  assert.match(bookingEdit, /booking-danger-zone/);
  assert.match(bookingEdit, /workspace-close/);
  assert.match(bookingEdit, /booking-edit-cancel/);
  assert.doesNotMatch(bookingEdit, /<details className="booking-edit-control"/);
  assert.match(overlay, /createPortal/);
  assert.match(overlay, /document\.body\.style\.overflow = "hidden"/);
  assert.match(css, /\.trip-console\{gap:10px\}/);
  assert.match(css, /\.trip-console-side\{padding-top:12px\}/);
  assert.match(css, /\.trip-plan-page,\.plan-columns,\.recommendation-panel,\.itinerary-panel\{overflow:visible\}/);
});

async function createTrip(body) {
  const response = await render("/api/trips", { method: "POST", body });
  const payload = await response.json();
  assert.equal(response.status, 201, payload.error);
  return payload.trip;
}

function timelineNodeBlocks(html) {
  return [...html.matchAll(/<article class="timeline-node[^>]*>[\s\S]*?<\/article>/g)].map(([block]) => block);
}

test("keeps all Stage A routes available", async () => {
  const [home, cities, city, map] = await Promise.all([render(), render("/cities"), render("/cities/shanghai"), render("/map")]);
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /跳进地理书/);
  assert.match(homeHtml, /<a[^>]+href="\/trips"[^>]*>进入攻略<\/a>/);
  assert.equal(cities.status, 200); assert.equal(city.status, 200); assert.equal(map.status, 200);
});

test("lists the Shanghai Hangzhou trip through the shared workspace", async () => {
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

test("hydrates Shanghai Hangzhou from D1 with stage participation after retiring legacy planning rows", async () => {
  const trip = DB.database.prepare("SELECT id, slug, title, status, start_date, end_date, people, protected FROM trips WHERE slug = ?").get("shanghai-hangzhou-2026");
  assert.deepEqual({ ...trip }, { id: "trip-shanghai-hangzhou-2026", slug: "shanghai-hangzhou-2026", title: "上海 + 杭州", status: "planning", start_date: "2026-09-23", end_date: "2026-09-27", people: 4, protected: 1 });
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
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trip_places WHERE trip_id = ?").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM day_places WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?)").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM places WHERE id IN ('place-pvg-t2','place-shanghai-south','place-shanghai-disney','place-oriental-pearl','place-the-bund','place-hangzhou-east') AND coordinate_system = 'GCJ02' AND latitude IS NOT NULL AND longitude IS NOT NULL").get().count, 6);
  const page = await render("/trips");
  assert.match(await page.text(), /上海4人 · 杭州5人/);
  const detail = await render("/trips/shanghai-hangzhou-2026");
  assert.equal(detail.status, 307);
  assert.equal(new URL(detail.headers.get("location"), "http://localhost").pathname, "/trips/shanghai-hangzhou-2026/plan");
  const plan = await render("/trips/shanghai-hangzhou-2026/plan?view=planning");
  assert.equal(plan.status, 200);
  const planHtml = await plan.text();
  assert.match(planHtml, /TRIP CONSOLE/);
  assert.match(planHtml, /攻略素材/);
  assert.doesNotMatch(planHtml, /简单方位图/);
  assert.doesNotMatch(planHtml, /active-candidate/);
});

test("keeps the confirmed flight personal and leaves airports pending", async () => {
  const flight = DB.database.prepare("SELECT id, title, booking_reference, origin_place_id, destination_place_id, total_amount_minor FROM bookings WHERE id = 'booking-shanghai-hangzhou-flight-szx-sha-20260923'").get();
  assert.deepEqual({ ...flight }, { id: "booking-shanghai-hangzhou-flight-szx-sha-20260923", title: "深圳 → 上海航班", booking_reference: "航班号：Y87578", origin_place_id: null, destination_place_id: null, total_amount_minor: 48000 });
  assert.deepEqual(DB.database.prepare("SELECT member_id FROM booking_participants WHERE booking_id = ?").all(flight.id).map((row) => row.member_id), ["member-nini"]);
  assert.deepEqual(DB.database.prepare("SELECT member_id, amount_minor FROM booking_cost_allocations WHERE cost_line_id = 'booking-cost-flight-y87578'").all().map((row) => ({ ...row })), [{ member_id: "member-nini", amount_minor: 48000 }]);
  const niniHtml = await (await render("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1")).text();
  assert.match(niniHtml, /深圳 → 上海航班/); assert.match(niniHtml, /起点待确认/); assert.match(niniHtml, /终点待确认/); assert.match(niniHtml, /完善起点/); assert.match(niniHtml, /完善终点/); assert.match(niniHtml, /¥480/);
  await loginAs("王静雯");
  const wangHtml = await (await render("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-1&member=member-wang-jingwen")).text();
  assert.doesNotMatch(wangHtml, /深圳 → 上海航班/);
  await loginAs("nini");
});

test("keeps the generic map fit guard and candidate marker semantics", () => {
  const planMap = readFileSync(new URL("../components/trip/PlanMap.tsx", import.meta.url), "utf8");
  assert.match(planMap, /markerObjects/);
  assert.match(planMap, /lastFitSignature/);
  assert.match(planMap, /setFitView\(markerObjects\.current\)/);
  assert.match(planMap, /当天成员尚未设置/);
  assert.match(planMap, /routeFare/);
  assert.match(planMap, /mainLine/);
  assert.doesNotMatch(planMap, /左转|右转/);
});

test("routes every Trip through the unified planning renderer without Shanghai-specific paths", () => {
  const route = readFileSync(new URL("../app/trips/[slug]/page.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/trip/TripPlanWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(route.includes("redirect(`/trips/${slug}/plan`)"));
  assert.doesNotMatch(route, /TripDetailPage|GenericTripDetail|protectedTripSlug|shanghai-hangzhou-2026/);
  assert.match(workspace, /timelineNodesByDay/);
  assert.match(workspace, /timelineEdgesByDay/);
  assert.doesNotMatch(workspace, /!trip\.protected/);
  for (const file of ["TripDetailPage.tsx", "GenericTripDetail.tsx", "DayPlacesEditor.tsx", "GenericTripMap.tsx", "ItineraryDragHandle.tsx", "BookingDisplayNameControl.tsx", "TimelinePlacementControl.tsx"]) {
    assert.equal(existsSync(new URL(`../components/trip/${file}`, import.meta.url)), false, `${file} should be retired`);
  }
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
  assert.equal(genericDetail.status, 307);
  assert.equal(new URL(genericDetail.headers.get("location"), "http://localhost").pathname, `/trips/${planningTrip.slug}/plan`);
  const plan = await render(`/trips/${planningTrip.slug}/plan`);
  const planHtml = await plan.text();
  assert.equal(plan.status, 200);
  assert.match(planHtml, /Tokyo Spring/); assert.match(planHtml, /TRIP CONSOLE/); assert.match(planHtml, /规划/);
});

test("avoids duplicate slugs", async () => {
  const duplicate = await createTrip({ title: "Tokyo Spring", status: "planning", cities: ["东京"], startDate: "2027-04-10", endDate: "2027-04-10", people: 1 });
  assert.equal(duplicate.slug, "tokyo-spring-2027-2");
});

test("returns a normal Not Found page for an unknown trip", async () => {
  const response = await render("/trips/does-not-exist");
  assert.equal(response.status, 404); assert.match(await response.text(), /没有找到这条行程/);
});

test("retires the old Shanghai Hangzhou detail behind the planning workspace", async () => {
  const response = await render("/trips/shanghai-hangzhou-2026");
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/trips/shanghai-hangzhou-2026/plan");
  const plan = await render("/trips/shanghai-hangzhou-2026/plan?view=planning");
  assert.equal(plan.status, 200);
  const html = await plan.text();
  assert.match(html, /TRIP CONSOLE/); assert.match(html, /上海迪士尼/); assert.match(html, /参与成员/);
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton|简单方位图/);
});

test("renders the E1 planning workspace from Booking, Recommendation and ItineraryItem truth", async () => {
  const day1 = "trip-shanghai-hangzhou-2026-day-1", day2 = "trip-shanghai-hangzhou-2026-day-2", day3 = "trip-shanghai-hangzhou-2026-day-3", day4 = "trip-shanghai-hangzhou-2026-day-4", day5 = "trip-shanghai-hangzhou-2026-day-5";
  const planning = await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day1}`), html = await planning.text();
  assert.equal(planning.status, 200);
  assert.match(html, /TRIP CONSOLE/); assert.match(html, /2026\.09\.23 — 09\.27/); assert.match(html, /上海4人 · 杭州5人/);
  assert.match(html, /06:35–08:55/); assert.match(html, /¥480/); assert.match(html, /上海南酒店/); assert.match(html, /杭州东酒店/); assert.match(html, /深圳.?→.?上海/); assert.match(html, /开园 → 闭园/); assert.match(html, /营业时间待确认/);
  for (const label of ["09/23", "09/24", "09/25", "09/26", "09/27"]) assert.match(html, new RegExp(label));
  assert.match(html, /攻略素材/); assert.match(html, /上海迪士尼/); assert.match(html, /已加入 09\/23/); assert.match(html, /data-timeline-edge-kind="long-distance"/); assert.doesNotMatch(html, /已确认订单/); assert.doesNotMatch(html, /Booking Anchor/); assert.match(html, /当天成员/);
  assert.doesNotMatch(html, /SZX-SHA-HGH|开始做选择|跳进地理书的旅行/);

  const day2Html = await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day2}`)).text();
  for (const label of ["武康大楼", "外滩", "东方明珠", "上海 → 杭州", "地点待确认"]) assert.match(day2Html, new RegExp(label));
  const day3Html = await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day3}`)).text();
  for (const label of ["灵隐寺", "财神庙", "西湖"]) assert.match(day3Html, new RegExp(label));
  assert.match(await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day4}`)).text(), /桐庐一日攻略 \/ 桐庐往返/);
  assert.match(await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day5}`)).text(), /杭州东酒店/);
});

test("renders a long-distance Booking as an edge between endpoint nodes", async () => {
  const trip = await createTrip({ title: "Timeline DOM Flight", status: "planning", cities: ["上海"], startDate: "2028-06-01", endDate: "2028-06-01", memberIds: ["member-nini"] });
  const dayId = DB.database.prepare("SELECT id FROM days WHERE trip_id = ? ORDER BY day_number LIMIT 1").get(trip.id).id;
  const bookingResponse = await render(`/api/trips/${trip.slug}/bookings`, { method: "POST", body: {
    type: "flight", status: "confirmed", title: "Y87578", startDateLocal: "2028-06-01", endDateLocal: "2028-06-01",
    startAt: "2028-05-31T22:35:00.000Z", endAt: "2028-06-01T00:55:00.000Z", originLabel: "深圳宝安国际机场", destinationLabel: "上海浦东国际机场",
    bookingReference: "Y87578", totalAmountMinor: 48000, participantMemberIds: ["member-nini"],
  } });
  assert.equal(bookingResponse.status, 201);
  const itemResponse = await render(`/api/trips/${trip.slug}/plan/items`, { method: "POST", body: { dayId, title: "上海迪士尼", itemType: "place", providerPlaceId: "B0TESTBUND" } });
  assert.equal(itemResponse.status, 201);
  const html = await (await render(`/trips/${trip.slug}/plan?view=planning&day=${dayId}`)).text();
  const nodes = timelineNodeBlocks(html);
  const endpoints = nodes.filter((block) => block.includes('data-timeline-node-kind="endpoint"'));
  assert.equal(endpoints.length, 2);
  assert.match(endpoints[0], /深圳宝安国际机场/);
  assert.match(endpoints[0], /timeline-index">01<\/div>/);
  assert.match(endpoints[1], /上海浦东国际机场/);
  assert.match(endpoints[1], /timeline-index">02<\/div>/);
  assert.equal(nodes.filter((block) => block.includes("深圳宝安国际机场 → 上海浦东国际机场")).length, 0);
  const nodeTitles = nodes.map((block) => block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] || "");
  assert.equal(nodeTitles.some((title) => title.includes("深圳宝安国际机场 → 上海浦东国际机场") || title.includes("深圳宝安国际机场→上海浦东国际机场")), false);
  assert.equal((html.match(/data-timeline-edge-kind="long-distance"/g) || []).length, 1);
  assert.match(html, /data-timeline-edge-kind="long-distance"[\s\S]*?飞机[\s\S]*?深圳宝安国际机场 → 上海浦东国际机场/);
  assert.equal((html.match(/data-timeline-edge-kind="local"/g) || []).length, 1);
  assert.match(html, /data-timeline-edge-kind="local"[\s\S]*?data-timeline-edge-state="pending"[\s\S]*?＋选择交通方式/);
  assert.equal(nodes.filter((block) => block.includes("上海迪士尼") && block.includes('data-timeline-node-kind="item"')).length, 1);
  assert.ok(html.indexOf('data-timeline-node-id="') < html.indexOf('data-timeline-edge-kind="long-distance"'));
  assert.equal((await render(`/api/trips/${trip.slug}`, { method: "DELETE" })).status, 200);
});

test("keeps accommodation Bookings out of Day Plan until a Hotel Item is explicit", async () => {
  const trip = await createTrip({ title: "Timeline DOM Hotel", status: "planning", cities: ["上海"], startDate: "2028-07-01", endDate: "2028-07-01", memberIds: ["member-nini"] });
  const dayId = DB.database.prepare("SELECT id FROM days WHERE trip_id = ? ORDER BY day_number LIMIT 1").get(trip.id).id;
  const bookingResponse = await render(`/api/trips/${trip.slug}/bookings`, { method: "POST", body: {
    type: "hotel", status: "confirmed", title: "DOM 测试住宿", startDateLocal: "2028-07-01", endDateLocal: "2028-07-02",
    place: { providerPlaceId: "B0TESTBUND" }, totalAmountMinor: 60000, participantMemberIds: ["member-nini"],
  } });
  assert.equal(bookingResponse.status, 201);
  const hotelPlaceId = DB.database.prepare("SELECT place_id FROM bookings WHERE id = ?").get((await bookingResponse.clone().json()).booking.id).place_id;
  const before = await (await render(`/trips/${trip.slug}/plan?view=planning&day=${dayId}`)).text();
  const beforeNodes = timelineNodeBlocks(before);
  assert.equal(beforeNodes.filter((block) => block.includes('data-timeline-node-kind="anchor"')).length, 0);
  assert.equal(beforeNodes.filter((block) => block.includes("DOM 测试住宿") || block.includes("入住")).length, 0);
  assert.doesNotMatch(before, /DOM 测试住宿 · 入住/);

  const titles = ["办理入住", "回酒店休息", "拿行李"];
  for (const title of titles) {
    const itemResponse = await render(`/api/trips/${trip.slug}/plan/items`, { method: "POST", body: { dayId, placeId: hotelPlaceId, itemType: "lodging", title } });
    assert.equal(itemResponse.status, 201);
  }
  const after = await (await render(`/trips/${trip.slug}/plan?view=planning&day=${dayId}`)).text();
  const afterNodes = timelineNodeBlocks(after);
  assert.equal(afterNodes.filter((block) => block.includes('data-timeline-node-kind="anchor"')).length, 0);
  const hotelNodes = afterNodes.filter((block) => block.includes('data-timeline-node-kind="item"') && titles.some((title) => block.includes(title)));
  assert.equal(hotelNodes.length, 3);
  for (const title of titles) assert.equal(hotelNodes.filter((block) => block.includes(title)).length, 1);
  assert.equal((await render(`/api/trips/${trip.slug}`, { method: "DELETE" })).status, 200);
});

test("renders accommodation editor as an independent modal without an inline details block", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const source = readFileSync(new URL("../components/trip/BookingEditControl.tsx", import.meta.url), "utf8");
  assert.match(source, /<WorkspaceOverlay[\s\S]*mode="drawer"/);
  assert.match(source, /className="booking-edit-dialog"/);
  assert.match(source, /ariaLabelledBy=\{headingId\}/);
  assert.match(source, /booking-edit-cancel/);
  assert.match(source, /booking-danger-zone/);
  assert.doesNotMatch(source, /<details className="booking-edit-control"/);
  assert.match(css, /\.workspace-surface\.booking-edit-dialog\{width:min\(520px,100%\);height:100%;max-height:100dvh/);
  assert.match(css, /@media\(max-width:680px\)\{[\s\S]*\.workspace-surface\.workspace-modal,\.workspace-surface\.workspace-drawer\{width:100%;height:100dvh/);
});

test("keeps Add Itinerary types focused on place nodes, long-distance edges, and no-place notes", () => {
  const source = readFileSync(new URL("../components/trip/PlanAddControl.tsx", import.meta.url), "utf8");
  const picker = readFileSync(new URL("../components/trip/GenericPlacePicker.tsx", import.meta.url), "utf8");
  assert.match(source, /role="tablist" aria-label="添加类型"/);
  for (const label of ["地点", "交通", "事项"]) assert.match(source, new RegExp(`>${label}<`));
  assert.match(source, /添加长途交通/);
  assert.match(source, /添加无地点事项/);
  assert.match(source, /showExisting=\{false\}/);
  assert.match(picker, /showExisting = true/);
  assert.match(picker, /autoFocus = false/);
  assert.match(picker, /placeholder=\{placeholder \|\|/);
  assert.doesNotMatch(source, /公共交通|打车|步行|骑行/);
});

test("validates E1 URL state and renders map and budget views", async () => {
  const invalid = await (await render("/trips/shanghai-hangzhou-2026/plan?view=wrong&day=other-trip-day")).text();
  assert.match(invalid, /09\/23[\s\S]{0,80}(?:Day 1|深圳[\s\S]{0,20}→[\s\S]{0,20}上海)/); assert.match(invalid, /攻略素材/);
  const mapResponse = await render("/trips/shanghai-hangzhou-2026/plan?view=map&mode=library&day=trip-shanghai-hangzhou-2026-day-2"), map = await mapResponse.text();
  assert.match(map, /攻略地图/); assert.match(map, /高德地图/); assert.match(map, /淡色 Marker/);
  const budget = await (await render("/trips/shanghai-hangzhou-2026/plan?view=budget&day=trip-shanghai-hangzhou-2026-day-3")).text();
  assert.match(budget, /我的费用/); assert.match(budget, /¥639\.11/); assert.match(budget, /我的费用待确认/); assert.match(budget, /订单总价不会直接算入个人费用/);
});

test("keeps Recommendation region and category independent from the active Day", async () => {
  const day1 = "trip-shanghai-hangzhou-2026-day-1", day3 = "trip-shanghai-hangzhou-2026-day-3";
  const shanghai = await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day1}&area=shanghai&category=attraction`)).text();
  for (const title of ["上海迪士尼", "武康大楼", "外滩", "东方明珠"]) assert.match(shanghai, new RegExp(`<h3>${title}</h3>`));
  assert.doesNotMatch(shanghai, /<h3>灵隐寺<\/h3>/); assert.match(shanghai, new RegExp(`day=${day3}&amp;area=shanghai&amp;category=attraction`));

  const hangzhouOnShanghaiDay = await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day1}&area=hangzhou&category=attraction`)).text();
  for (const title of ["灵隐寺", "财神庙", "西湖"]) assert.match(hangzhouOnShanghaiDay, new RegExp(`<h3>${title}</h3>`));
  assert.doesNotMatch(hangzhouOnShanghaiDay, /<h3>上海迪士尼<\/h3>/); assert.match(hangzhouOnShanghaiDay, new RegExp(`day=${day3}&amp;area=hangzhou&amp;category=attraction`));

  const tonglu = await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day1}&area=tonglu&category=guide`)).text();
  assert.match(tonglu, /<h3>桐庐一日攻略<\/h3>/); assert.doesNotMatch(tonglu, /<h3>西湖<\/h3>/); assert.match(tonglu, /桐庐(?:<!-- -->)? · (?:<!-- -->)?攻略/);
  assert.equal(DB.database.prepare("SELECT COUNT(*) count FROM cities WHERE name = '桐庐' OR name = '桐庐市'").get().count, 0);
});

test("opens the full Recommendation Library without coupling it to the active Day", async () => {
  const response = await render("/trips/shanghai-hangzhou-2026/plan?view=planning&library=all&day=trip-shanghai-hangzhou-2026-day-1&area=hangzhou&category=food&q=杭帮菜");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /TRIP LIBRARY/);
  assert.match(html, /攻略资料库/);
  assert.match(html, /杭州/);
  assert.match(html, /美食/);
  assert.match(html, /杭帮菜/);
  assert.match(html, /← 返回规划/);
  assert.match(html, /library=all/);
});

test("E1 add-to-Day writes only ItineraryItem and keeps Legacy tables frozen", async () => {
  const day5 = "trip-shanghai-hangzhou-2026-day-5";
  const legacyDayBefore = DB.database.prepare("SELECT json_group_array(json_object('day',day_id,'place',place_id,'sort',sort_order)) value FROM (SELECT * FROM day_places ORDER BY day_id, sort_order)").get().value;
  const legacyTripBefore = DB.database.prepare("SELECT json_group_array(json_object('trip',trip_id,'place',place_id,'status',plan_status)) value FROM (SELECT * FROM trip_places ORDER BY trip_id, place_id)").get().value;
  const add = await render("/api/trips/shanghai-hangzhou-2026/plan/items", { method: "POST", body: { recommendationId: "recommendation-west-lake", dayId: day5 } });
  assert.equal(add.status, 201);
  const item = (await add.json()).item; assert.equal(item.dayId, day5); assert.equal(item.lockedAt, null); assert.equal(item.placeId, null);
  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('day',day_id,'place',place_id,'sort',sort_order)) value FROM (SELECT * FROM day_places ORDER BY day_id, sort_order)").get().value, legacyDayBefore);
  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('trip',trip_id,'place',place_id,'status',plan_status)) value FROM (SELECT * FROM trip_places ORDER BY trip_id, place_id)").get().value, legacyTripBefore);
});

test("manages duplicate Recommendation items independently without touching Booking or Legacy", async () => {
  const day4 = "trip-shanghai-hangzhou-2026-day-4", day5 = "trip-shanghai-hangzhou-2026-day-5", recommendationId = "recommendation-wukang-building";
  const legacyDayBefore = DB.database.prepare("SELECT json_group_array(json_object('day',day_id,'place',place_id,'sort',sort_order)) value FROM (SELECT * FROM day_places ORDER BY day_id, sort_order)").get().value;
  const legacyTripBefore = DB.database.prepare("SELECT json_group_array(json_object('trip',trip_id,'place',place_id,'status',plan_status)) value FROM (SELECT * FROM trip_places ORDER BY trip_id, place_id)").get().value;
  const bookingBefore = DB.database.prepare("SELECT json_group_array(json_object('id',id,'title',title,'status',status)) value FROM (SELECT * FROM bookings ORDER BY id)").get().value;
  const recommendationBefore = DB.database.prepare("SELECT * FROM recommendations WHERE id = ?").get(recommendationId);

  const first = (await (await render("/api/trips/shanghai-hangzhou-2026/plan/items", { method: "POST", body: { recommendationId, dayId: day5 } })).json()).item;
  const second = (await (await render("/api/trips/shanghai-hangzhou-2026/plan/items", { method: "POST", body: { recommendationId, dayId: day5 } })).json()).item;
  assert.notEqual(first.id, second.id); assert.equal(first.dayId, day5); assert.equal(second.dayId, day5);
  const duplicateHtml = await (await render(`/trips/shanghai-hangzhou-2026/plan?view=planning&day=${day5}`)).text();
  assert.match(duplicateHtml, /已加入 09\/24 · 09\/27 ×2/); assert.match(duplicateHtml, /再次加入/);

  const firstEdit = await render(`/api/trips/shanghai-hangzhou-2026/plan/items/${first.id}`, { method: "PATCH", body: { title: "武康大楼上午", note: "第一条", dayId: day5 } });
  const secondEdit = await render(`/api/trips/shanghai-hangzhou-2026/plan/items/${second.id}`, { method: "PATCH", body: { title: "武康大楼傍晚", note: "第二条", dayId: day5 } });
  assert.equal(firstEdit.status, 200); assert.equal(secondEdit.status, 200);
  assert.equal(DB.database.prepare("SELECT title FROM itinerary_items WHERE id = ?").get(first.id).title, "武康大楼上午");
  assert.equal(DB.database.prepare("SELECT title FROM itinerary_items WHERE id = ?").get(second.id).title, "武康大楼傍晚");

  const moved = await render(`/api/trips/shanghai-hangzhou-2026/plan/items/${first.id}`, { method: "PATCH", body: { dayId: day4 } });
  assert.equal(moved.status, 200); const movedItem = (await moved.json()).item; assert.equal(movedItem.dayId, day4);
  const targetOrders = DB.database.prepare("SELECT sort_order FROM itinerary_items WHERE day_id = ? ORDER BY sort_order").all(day4).map((row) => row.sort_order);
  assert.deepEqual(targetOrders, targetOrders.map((_, index) => index + 1));
  const sourceOrders = DB.database.prepare("SELECT sort_order FROM itinerary_items WHERE day_id = ? ORDER BY sort_order").all(day5).map((row) => row.sort_order);
  assert.deepEqual(sourceOrders, sourceOrders.map((_, index) => index + 1));

  const removed = await render(`/api/trips/shanghai-hangzhou-2026/plan/items/${second.id}`, { method: "DELETE" });
  assert.equal(removed.status, 200); assert.equal(DB.database.prepare("SELECT COUNT(*) count FROM itinerary_items WHERE id = ?").get(second.id).count, 0); assert.equal(DB.database.prepare("SELECT COUNT(*) count FROM itinerary_items WHERE id = ?").get(first.id).count, 1);
  assert.deepEqual(DB.database.prepare("SELECT * FROM recommendations WHERE id = ?").get(recommendationId), recommendationBefore);
  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('id',id,'title',title,'status',status)) value FROM (SELECT * FROM bookings ORDER BY id)").get().value, bookingBefore);
  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('day',day_id,'place',place_id,'sort',sort_order)) value FROM (SELECT * FROM day_places ORDER BY day_id, sort_order)").get().value, legacyDayBefore);
  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('trip',trip_id,'place',place_id,'status',plan_status)) value FROM (SELECT * FROM trip_places ORDER BY trip_id, place_id)").get().value, legacyTripBefore);
});

test("protects E1 routes and gives Generic Trip an empty workspace", async () => {
  const generic = await createTrip({ title: "E1 Empty Trip", status: "planning", cities: ["苏州"], startDate: "2027-07-01", endDate: "2027-07-01", people: 1 });
  const genericHtml = await (await render(`/trips/${generic.slug}/plan`)).text();
  assert.match(genericHtml, /E1 Empty Trip/); assert.match(genericHtml, /尚未安排/); assert.match(genericHtml, /还没有添加住宿/); assert.match(genericHtml, /找想去的地方/); assert.match(genericHtml, /添加行程/); assert.doesNotMatch(genericHtml, /添加长途交通/);
  const saved = sessionCookie; sessionCookie = "";
  const anonymous = await render("/trips/shanghai-hangzhou-2026/plan?view=map&day=trip-shanghai-hangzhou-2026-day-2");
  assert.equal(anonymous.status, 302); assert.equal(new URL(anonymous.headers.get("location")).searchParams.get("returnTo"), "/trips/shanghai-hangzhou-2026/plan?view=map&day=trip-shanghai-hangzhou-2026-day-2");
  const denied = await render("/api/trips/shanghai-hangzhou-2026/plan/items", { method: "POST", body: { recommendationId: "recommendation-west-lake", dayId: "trip-shanghai-hangzhou-2026-day-5" } }); assert.equal(denied.status, 302);
  sessionCookie = saved;
});

test("creates a dated Generic Trip without TripCity or seeded business data", async () => {
  const trip = await createTrip({ title: "V2.4 Empty Generic", status: "planning", startDate: "2028-03-01", endDate: "2028-03-02", memberIds: ["member-zhu-jingqi"] });
  assert.equal(DB.database.prepare("SELECT count(*) count FROM trip_cities WHERE trip_id = ?").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM bookings WHERE trip_id = ?").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM itinerary_items WHERE trip_id = ?").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM expenses WHERE trip_id = ?").get(trip.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM days WHERE trip_id = ?").get(trip.id).count, 2);
  const html = await (await render(`/trips/${trip.slug}/plan`)).text();
  assert.match(html, /还没有添加住宿/); assert.match(html, /找想去的地方/); assert.match(html, /尚未安排/);
  assert.equal((await render(`/api/trips/${trip.slug}`, { method: "DELETE" })).status, 200);
});

test("reuses a real AMap Place for repeated Day items and one accommodation Booking", async () => {
  const trip = await createTrip({ title: "V2.4 Place Reuse", status: "planning", startDate: "2028-04-01", endDate: "2028-04-01", memberIds: [] });
  const dayId = DB.database.prepare("SELECT id FROM days WHERE trip_id = ?").get(trip.id).id;
  const first = await render(`/api/trips/${trip.slug}/plan/items`, { method: "POST", body: { dayId, providerPlaceId: "B0TESTBUND", itemType: "place" } });
  const second = await render(`/api/trips/${trip.slug}/plan/items`, { method: "POST", body: { dayId, providerPlaceId: "B0TESTBUND", itemType: "place", title: "再次到访" } });
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  const firstItem = (await first.json()).item, secondItem = (await second.json()).item;
  assert.notEqual(firstItem.id, secondItem.id); assert.equal(firstItem.placeId, secondItem.placeId);
  const hotel = await render(`/api/trips/${trip.slug}/bookings`, { method: "POST", body: { type: "hotel", status: "tentative", title: "住宿候选", startDateLocal: "2028-04-01", endDateLocal: "2028-04-02", place: { placeId: firstItem.placeId }, participantMemberIds: ["member-nini"], totalAmountMinor: 60000 } });
  assert.equal(hotel.status, 201);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM places WHERE provider = 'amap' AND provider_place_id = 'B0TESTBUND'").get().count, 1);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM itinerary_items WHERE trip_id = ? AND place_id = ?").get(trip.id, firstItem.placeId).count, 2);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM bookings WHERE trip_id = ? AND place_id = ?").get(trip.id, firstItem.placeId).count, 1);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM trip_cities WHERE trip_id = ?").get(trip.id).count, 1);
  assert.equal((await render(`/api/trips/${trip.slug}`, { method: "DELETE" })).status, 200);
});

test("preserves calendar Day IDs and guards occupied date and referenced member removal", async () => {
  const trip = await createTrip({ title: "V2.4 Safe Edit", status: "planning", startDate: "2028-05-02", endDate: "2028-05-03", memberIds: ["member-zhu-jingqi"] });
  const original = DB.database.prepare("SELECT id, date FROM days WHERE trip_id = ? ORDER BY date").all(trip.id);
  const extend = await render(`/api/trips/${trip.slug}`, { method: "PUT", body: { title: trip.title, status: "planning", startDate: "2028-05-01", endDate: "2028-05-04", memberIds: ["member-zhu-jingqi"] } });
  assert.equal(extend.status, 200);
  for (const day of original) assert.equal(DB.database.prepare("SELECT id FROM days WHERE trip_id = ? AND date = ?").get(trip.id, day.date).id, day.id);
  const occupiedDay = DB.database.prepare("SELECT id FROM days WHERE trip_id = ? AND date = '2028-05-04'").get(trip.id).id;
  assert.equal((await render(`/api/trips/${trip.slug}/plan/items`, { method: "POST", body: { dayId: occupiedDay, title: "保留的规划", itemType: "note" } })).status, 201);
  const shrink = await render(`/api/trips/${trip.slug}`, { method: "PUT", body: { title: trip.title, status: "planning", startDate: "2028-05-01", endDate: "2028-05-03", memberIds: ["member-zhu-jingqi"] } });
  assert.equal(shrink.status, 409);
  assert.equal(DB.database.prepare("SELECT end_date FROM trips WHERE id = ?").get(trip.id).end_date, "2028-05-04");
  const memberBooking = await render(`/api/trips/${trip.slug}/bookings`, { method: "POST", body: { type: "other", status: "tentative", title: "kiki 个人交通", startDateLocal: "2028-05-02", participantMemberIds: ["member-zhu-jingqi"] } });
  assert.equal(memberBooking.status, 201);
  const removeMember = await render(`/api/trips/${trip.slug}`, { method: "PUT", body: { title: trip.title, status: "planning", startDate: "2028-05-01", endDate: "2028-05-04", memberIds: [] } });
  assert.equal(removeMember.status, 409);
  assert.equal(DB.database.prepare("SELECT count(*) count FROM trip_members WHERE trip_id = ? AND member_id = 'member-zhu-jingqi'").get(trip.id).count, 1);
  assert.equal((await render(`/api/trips/${trip.slug}`, { method: "DELETE" })).status, 200);
});

test("requires a member session and supports collaborative edit and delete", async () => {
  const saved = sessionCookie; sessionCookie = "";
  const anonymous = await render("/trips?status=planning"); assert.equal(anonymous.status, 302); assert.equal(new URL(anonymous.headers.get("location")).searchParams.get("returnTo"), "/trips?status=planning");
  const anonymousRoot = await render("/"); assert.equal(new URL(anonymousRoot.headers.get("location")).searchParams.get("returnTo"), "/");
  const anonymousDeep = await render("/trips/shanghai-hangzhou-2026"); assert.equal(new URL(anonymousDeep.headers.get("location")).searchParams.get("returnTo"), "/trips/shanghai-hangzhou-2026");
  const unlock = await render("/unlock?returnTo=https://evil.example/phish"); assert.equal(unlock.status, 200); const unlockHtml = await unlock.text(); assert.equal(unlockHtml.match(/evil\.example/g)?.length, 1);
  sessionCookie = saved;
  const trip = await createTrip({ title: "朋友旅行", status: "planning", cities: ["苏州"], undated: true, people: 2, memberIds: ["member-zhu-jingqi"] });
  const listAfterCreate = await render("/trips");
  const listHtml = await listAfterCreate.text();
  assert.match(listHtml, /class="trip-delete-button"[^>]+data-trip-slug="[^"]+"/);
  assert.match(listHtml, /aria-label="删除行程：上海 \+ 杭州"/);
  const niniSession = sessionCookie;
  await loginAs("王静雯");
  const memberList = await render("/trips");
  assert.match(await memberList.text(), /class="trip-delete-button"[^>]+disabled/);
  const deniedDelete = await render(`/api/trips/${trip.slug}`, { method: "DELETE" });
  assert.equal(deniedDelete.status, 403);
  sessionCookie = niniSession;
  const update = await render(`/api/trips/${trip.slug}`, { method: "PUT", body: { title: "朋友旅行更新", status: "completed", cities: ["苏州", "无锡"], undated: true, people: 2, memberIds: ["member-zhu-jingqi"] } });
  assert.equal(update.status, 200); assert.equal((await update.json()).trip.status, "completed");
  const remove = await render(`/api/trips/${trip.slug}`, { method: "DELETE" }); assert.equal(remove.status, 200);
});

test("deletes ordinary Trips without removing shared Places, Recommendations, or Members", async () => {
  const tripA = await createTrip({ title: "删除隔离 A", status: "planning", cities: ["上海"], startDate: "2029-01-01", endDate: "2029-01-01", people: 1 });
  const tripB = await createTrip({ title: "删除隔离 B", status: "planning", cities: ["上海"], undated: true, people: 1 });
  const sharedPlaceId = "place-pvg-t2", unrelatedRecommendationId = "recommendation-west-lake";
  const placeBefore = DB.database.prepare("SELECT id FROM places WHERE id = ?").get(sharedPlaceId);
  const recommendationBefore = DB.database.prepare("SELECT id, title FROM recommendations WHERE id = ?").get(unrelatedRecommendationId);
  const membersBefore = DB.database.prepare("SELECT id FROM members ORDER BY id").all().map((row) => row.id);
  assert.ok(placeBefore); assert.ok(recommendationBefore);
  // Reproduce the production failure mode: a legacy item still points at a
  // Trip stage, whose FK is RESTRICT. The delete service must clear this
  // Trip-owned relationship before removing the parent row.
  const dayA = DB.database.prepare("SELECT id FROM days WHERE trip_id = ? LIMIT 1").get(tripA.id).id;
  const cityA = DB.database.prepare("SELECT city_id FROM trip_cities WHERE trip_id = ? LIMIT 1").get(tripA.id).city_id;
  const stageA = "delete-isolation-stage-a";
  DB.database.prepare("INSERT INTO trip_stages (id, trip_id, city_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(stageA, tripA.id, cityA, "删除测试阶段", new Date().toISOString(), new Date().toISOString());
  DB.database.prepare("INSERT INTO itinerary_items (id, trip_id, day_id, stage_id, item_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 'note', ?, 1, ?, ?)").run("delete-isolation-item-a", tripA.id, dayA, stageA, "阶段关联事项", new Date().toISOString(), new Date().toISOString());
  // Exercise the real FK relationship: deleting a Trip removes its link but
  // must never remove the globally reusable Place row.
  DB.database.prepare("INSERT INTO trip_places (trip_id, place_id, plan_status, created_at) VALUES (?, ?, 'selected', ?)").run(tripA.id, sharedPlaceId, new Date().toISOString());
  DB.database.prepare("UPDATE trips SET protected = 1 WHERE id = ?").run(tripA.id);
  assert.equal((await render(`/api/trips/${tripA.slug}`, { method: "DELETE" })).status, 200);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trips WHERE id = ?").get(tripA.id).count, 0);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM trips WHERE id = ?").get(tripB.id).count, 1);
  assert.deepEqual(DB.database.prepare("SELECT id FROM places WHERE id = ?").get(sharedPlaceId), placeBefore);
  assert.deepEqual(DB.database.prepare("SELECT id, title FROM recommendations WHERE id = ?").get(unrelatedRecommendationId), recommendationBefore);
  assert.deepEqual(DB.database.prepare("SELECT id FROM members ORDER BY id").all().map((row) => row.id), membersBefore);
  assert.equal((await render(`/api/trips/${tripB.slug}`, { method: "DELETE" })).status, 200);
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

test("binds a nullable hotel Place without changing booking facts", async () => {
  await loginAs("nini");
  const bookingId = "booking-shanghai-hangzhou-hotel-hangzhou-20260924";
  const before = DB.database.prepare("SELECT start_date_local, end_date_local, total_amount_minor, place_id FROM bookings WHERE id = ?").get(bookingId);
  assert.equal(before.place_id, null);
  const hangzhouCity = DB.database.prepare("SELECT city_id FROM trip_cities WHERE trip_id = 'trip-shanghai-hangzhou-2026' AND city_id LIKE '%hangzhou%' LIMIT 1").get().city_id;
  const placeResponse = await render("/api/trips/shanghai-hangzhou-2026/plan/places", { method: "POST", body: { providerPlaceId: "B0TESTHANGZHOU", cityId: hangzhouCity } });
  assert.equal(placeResponse.status, 201);
  const place = (await placeResponse.json()).place;
  assert.equal(place.provider, "amap"); assert.equal(place.providerPlaceId, "B0TESTHANGZHOU"); assert.equal(place.coordinateSystem, "GCJ02");
  const bind = await render(`/api/trips/shanghai-hangzhou-2026/budget/bookings/${bookingId}`, { method: "PATCH", body: { placeId: place.id } });
  assert.equal(bind.status, 200);
  const after = DB.database.prepare("SELECT start_date_local, end_date_local, total_amount_minor, place_id FROM bookings WHERE id = ?").get(bookingId);
  assert.deepEqual({ ...after }, { start_date_local: before.start_date_local, end_date_local: before.end_date_local, total_amount_minor: before.total_amount_minor, place_id: place.id });
  const planHtml = await (await render("/trips/shanghai-hangzhou-2026/plan?view=planning&day=trip-shanghai-hangzhou-2026-day-2")).text();
  assert.match(planHtml, /测试杭州酒店/);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM bookings WHERE id = ?").get(bookingId).count, 1);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM itinerary_items WHERE title LIKE '%杭州酒店%'").get().count, 0);
});

test("keeps budget plans, expenses, and booking edits member-scoped", async () => {
  const legacyDayBefore = DB.database.prepare("SELECT json_group_array(json_object('day',day_id,'place',place_id,'sort',sort_order)) value FROM (SELECT * FROM day_places ORDER BY day_id, sort_order)").get().value;
  const legacyTripBefore = DB.database.prepare("SELECT json_group_array(json_object('trip',trip_id,'place',place_id,'status',plan_status)) value FROM (SELECT * FROM trip_places ORDER BY trip_id, place_id)").get().value;
  const day3 = "trip-shanghai-hangzhou-2026-day-3";

  await loginAs("nini");
  const initial = await (await render("/api/trips/shanghai-hangzhou-2026/budget/plans")).json();
  assert.equal(initial.budget.totals.fixedPersonalMinor, 63911);
  assert.equal(initial.budget.totals.plannedMinor, 0);
  assert.equal(initial.budget.bookings.find((booking) => booking.title === "深圳 → 上海航班").ownAmountMinor, 48000);
  const niniPlan = await render("/api/trips/shanghai-hangzhou-2026/budget/plans", { method: "PUT", body: { category: "food", plannedAmountMinor: 12000 } });
  assert.equal(niniPlan.status, 200);

  const personal = await render("/api/trips/shanghai-hangzhou-2026/budget/expenses", { method: "POST", body: { title: "nini 私人购物", amountMinor: 39900, category: "shopping", scope: "personal", dayId: day3 } });
  assert.equal(personal.status, 201);
  const personalId = (await personal.json()).expense.id;
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM expense_allocations WHERE expense_id = ? AND member_id = 'member-nini' AND amount_minor = 39900").get(personalId).count, 1);

  await loginAs("王静雯");
  const wangPlan = await render("/api/trips/shanghai-hangzhou-2026/budget/plans", { method: "PUT", body: { category: "food", plannedAmountMinor: 5000 } });
  assert.equal(wangPlan.status, 200);
  const wangBudget = (await (await render("/api/trips/shanghai-hangzhou-2026/budget/plans")).json()).budget;
  assert.equal(wangBudget.plans.find((plan) => plan.category === "food").plannedAmountMinor, 5000);
  assert.doesNotMatch(await (await render("/trips/shanghai-hangzhou-2026/plan?view=budget")).text(), /nini 私人购物/);
  const forbiddenPersonalEdit = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${personalId}`, { method: "PATCH", body: { title: "越权修改" } });
  assert.equal(forbiddenPersonalEdit.status, 403);

  await loginAs("kiki");
  const zhuBudget = (await (await render("/api/trips/shanghai-hangzhou-2026/budget/plans")).json()).budget;
  assert.equal(zhuBudget.totals.fixedPersonalMinor, 11636);

  await loginAs("nini");
  const sharedEqual = await render("/api/trips/shanghai-hangzhou-2026/budget/expenses", { method: "POST", body: { title: "共享晚餐均摊", amountMinor: 10001, category: "food", scope: "shared", paidByMemberId: "member-zhu-jingqi", participantMemberIds: ["member-nini", "member-wang-jingwen", "member-zhu-jingqi"], dayId: day3 } });
  assert.equal(sharedEqual.status, 201);
  const sharedEqualId = (await sharedEqual.json()).expense.id;
  const equalAllocations = DB.database.prepare("SELECT member_id, amount_minor FROM expense_allocations WHERE expense_id = ? ORDER BY member_id").all(sharedEqualId);
  assert.deepEqual(equalAllocations.map((row) => ({ ...row })), [{ member_id: "member-nini", amount_minor: 3334 }, { member_id: "member-wang-jingwen", amount_minor: 3334 }, { member_id: "member-zhu-jingqi", amount_minor: 3333 }]);
  assert.equal(equalAllocations.reduce((sum, row) => sum + row.amount_minor, 0), 10001);

  const sharedCustom = await render("/api/trips/shanghai-hangzhou-2026/budget/expenses", { method: "POST", body: { title: "共享打车自定义", amountMinor: 10000, category: "local_transport", scope: "shared", paidByMemberId: "member-wang-jingwen", allocations: [{ memberId: "member-nini", amountMinor: 7000 }, { memberId: "member-wang-jingwen", amountMinor: 3000 }], dayId: day3 } });
  assert.equal(sharedCustom.status, 201);
  const sharedCustomId = (await sharedCustom.json()).expense.id;
  const customUpdate = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${sharedCustomId}`, { method: "PATCH", body: { amountMinor: 11000, allocations: [{ memberId: "member-nini", amountMinor: 8000 }, { memberId: "member-wang-jingwen", amountMinor: 3000 }] } });
  assert.equal(customUpdate.status, 200);
  assert.equal(DB.database.prepare("SELECT sum(amount_minor) AS total FROM expense_allocations WHERE expense_id = ?").get(sharedCustomId).total, 11000);

  const shared500 = await render("/api/trips/shanghai-hangzhou-2026/budget/expenses", { method: "POST", body: { title: "四人晚饭", amountMinor: 50000, category: "food", scope: "shared", paidByMemberId: "member-nini", participantMemberIds: ["member-nini", "member-wang-jingwen", "member-liu-xu", "member-sun-yan"], dayId: day3, occurredDate: "2026-09-25" } });
  assert.equal(shared500.status, 201);
  const shared500Id = (await shared500.json()).expense.id;
  const fourWay = DB.database.prepare("SELECT member_id, amount_minor FROM expense_allocations WHERE expense_id = ? ORDER BY member_id").all(shared500Id);
  assert.deepEqual(fourWay.map((row) => ({ ...row })), [
    { member_id: "member-liu-xu", amount_minor: 12500 }, { member_id: "member-nini", amount_minor: 12500 }, { member_id: "member-sun-yan", amount_minor: 12500 }, { member_id: "member-wang-jingwen", amount_minor: 12500 },
  ]);
  assert.equal(fourWay.reduce((sum, row) => sum + row.amount_minor, 0), 50000);
  const sharedRemainder = await render("/api/trips/shanghai-hangzhou-2026/budget/expenses", { method: "POST", body: { title: "三人小食", amountMinor: 10000, category: "food", scope: "shared", paidByMemberId: "member-nini", participantMemberIds: ["member-nini", "member-wang-jingwen", "member-zhu-jingqi"], dayId: day3 } });
  assert.equal(sharedRemainder.status, 201);
  const sharedRemainderId = (await sharedRemainder.json()).expense.id;
  const remainder = DB.database.prepare("SELECT member_id, amount_minor FROM expense_allocations WHERE expense_id = ? ORDER BY member_id").all(sharedRemainderId);
  assert.equal(remainder.reduce((sum, row) => sum + row.amount_minor, 0), 10000);
  assert.deepEqual(remainder.map((row) => ({ ...row })), [{ member_id: "member-nini", amount_minor: 3334 }, { member_id: "member-wang-jingwen", amount_minor: 3333 }, { member_id: "member-zhu-jingqi", amount_minor: 3333 }]);

  await loginAs("王静雯");
  const wangShared = (await (await render("/api/trips/shanghai-hangzhou-2026/budget/expenses")).json()).budget.expenses.find((expense) => expense.id === shared500Id);
  assert.equal(wangShared.ownAmountMinor, 12500);
  const wangCustom = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${shared500Id}`, { method: "PATCH", body: { amountMinor: 50000, allocations: [{ memberId: "member-nini", amountMinor: 12000 }, { memberId: "member-wang-jingwen", amountMinor: 12000 }, { memberId: "member-liu-xu", amountMinor: 12000 }, { memberId: "member-sun-yan", amountMinor: 14000 }] } });
  assert.equal(wangCustom.status, 200);
  assert.equal(DB.database.prepare("SELECT sum(amount_minor) AS total FROM expense_allocations WHERE expense_id = ?").get(shared500Id).total, 50000);
  await loginAs("nini");
  const sharedRemainderDelete = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${sharedRemainderId}`, { method: "DELETE" });
  assert.equal(sharedRemainderDelete.status, 200);
  const shared500Delete = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${shared500Id}`, { method: "DELETE" });
  assert.equal(shared500Delete.status, 200);
  assert.equal(DB.database.prepare("SELECT count(*) AS count FROM expenses WHERE id IN (?, ?) AND deleted_at IS NOT NULL").get(shared500Id, sharedRemainderId).count, 2);

  const personalUpdate = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${personalId}`, { method: "PATCH", body: { amountMinor: 40000, title: "nini 私人购物更新" } });
  assert.equal(personalUpdate.status, 200);
  const personalDelete = await render(`/api/trips/shanghai-hangzhou-2026/budget/expenses/${personalId}`, { method: "DELETE" });
  assert.equal(personalDelete.status, 200);
  assert.equal(DB.database.prepare("SELECT deleted_at IS NOT NULL AS deleted FROM expenses WHERE id = ?").get(personalId).deleted, 1);

  const bookingId = "booking-shanghai-hangzhou-hotel-hangzhou-20260924";
  const bookingEdit = await render(`/api/trips/shanghai-hangzhou-2026/budget/bookings/${bookingId}`, { method: "PATCH", body: { title: "杭州东附近酒店", status: "confirmed" } });
  assert.equal(bookingEdit.status, 200);
  const unbalanced = await render(`/api/trips/shanghai-hangzhou-2026/budget/bookings/${bookingId}`, { method: "PATCH", body: { totalAmountMinor: 76000 } });
  assert.equal(unbalanced.status, 409);
  assert.equal(DB.database.prepare("SELECT total_amount_minor FROM bookings WHERE id = ?").get(bookingId).total_amount_minor, 75280);
  assert.equal(DB.database.prepare("SELECT sum(amount_minor) AS total FROM booking_cost_allocations WHERE cost_line_id IN (SELECT id FROM booking_cost_lines WHERE booking_id = ?)").get(bookingId).total, 75280);

  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('day',day_id,'place',place_id,'sort',sort_order)) value FROM (SELECT * FROM day_places ORDER BY day_id, sort_order)").get().value, legacyDayBefore);
  assert.equal(DB.database.prepare("SELECT json_group_array(json_object('trip',trip_id,'place',place_id,'status',plan_status)) value FROM (SELECT * FROM trip_places ORDER BY trip_id, place_id)").get().value, legacyTripBefore);
  const finalHtml = await (await render("/trips/shanghai-hangzhou-2026/plan?view=budget")).text();
  assert.match(finalHtml, /value="120\.00"/); assert.match(finalHtml, /共享晚餐均摊/); assert.match(finalHtml, /我的费用待确认/);
});
