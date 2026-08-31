import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");

const migrations = [
  "0000_strange_unus.sql",
  "0001_fancy_sharon_carter.sql",
  "0002_cynical_umar.sql",
  "0003_bright_prodigy.sql",
  "0004_clean_starfox.sql",
  "0005_omniscient_la_nuit.sql",
  "0006_right_queen_noir.sql",
];

for (const file of migrations) {
  db.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
}

db.exec(`
  INSERT INTO trips (id, slug, title, status, start_date, end_date, people, created_at, updated_at, protected, created_by_member_id, updated_by_member_id)
  VALUES ('bde38af5-3feb-4840-8e02-9e0bc0380f76', 'trip-undated-bde38af5', '测试', 'inspiration', '2026-09-01', '2026-09-02', 1, '2026-08-31T10:41:55.804Z', '2026-08-31T10:59:54.618Z', 0, 'member-nini', 'member-nini');
  INSERT INTO days (id, trip_id, day_number, date, title) VALUES
    ('bde38af5-3feb-4840-8e02-9e0bc0380f76-day-1', 'bde38af5-3feb-4840-8e02-9e0bc0380f76', 1, '2026-09-01', 'Day 1'),
    ('bde38af5-3feb-4840-8e02-9e0bc0380f76-day-2', 'bde38af5-3feb-4840-8e02-9e0bc0380f76', 2, '2026-09-02', 'Day 2');
  INSERT INTO trip_members (trip_id, member_id) VALUES ('bde38af5-3feb-4840-8e02-9e0bc0380f76', 'member-nini');
`);

const legacyTripPlaces = db.prepare("SELECT * FROM trip_places WHERE trip_id = ? ORDER BY place_id").all("trip-shanghai-hangzhou-2026");
const legacyDayPlaces = db.prepare("SELECT * FROM day_places WHERE day_id LIKE 'trip-shanghai-hangzhou-2026-day-%' ORDER BY day_id, sort_order").all();
const testTripBefore = db.prepare("SELECT * FROM trips WHERE slug = ?").get("trip-undated-bde38af5");
const testDaysBefore = db.prepare("SELECT * FROM days WHERE trip_id = ? ORDER BY day_number").all(testTripBefore.id);

const e0cSql = readFileSync(new URL("../drizzle/0007_shanghai_hangzhou_real_trip.sql", import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");
db.exec(e0cSql);

test("E0C migrates only confirmed Shanghai Hangzhou facts", () => {
  const trip = db.prepare("SELECT start_date, end_date, timezone FROM trips WHERE id = ?").get("trip-shanghai-hangzhou-2026");
  assert.deepEqual({ ...trip }, { start_date: "2026-09-23", end_date: "2026-09-27", timezone: "Asia/Shanghai" });

  const days = db.prepare("SELECT id, day_number, date FROM days WHERE trip_id = ? ORDER BY day_number").all("trip-shanghai-hangzhou-2026");
  assert.deepEqual(days.map((day) => ({ ...day })), [
    { id: "trip-shanghai-hangzhou-2026-day-1", day_number: 1, date: "2026-09-23" },
    { id: "trip-shanghai-hangzhou-2026-day-2", day_number: 2, date: "2026-09-24" },
    { id: "trip-shanghai-hangzhou-2026-day-3", day_number: 3, date: "2026-09-25" },
    { id: "trip-shanghai-hangzhou-2026-day-4", day_number: 4, date: "2026-09-26" },
    { id: "trip-shanghai-hangzhou-2026-day-5", day_number: 5, date: "2026-09-27" },
  ]);

  assert.equal(db.prepare("SELECT count(*) count FROM bookings WHERE trip_id = ? AND status = 'confirmed'").get("trip-shanghai-hangzhou-2026").count, 3);
  assert.equal(db.prepare("SELECT count(*) count FROM booking_participants").get().count, 0);
  assert.equal(db.prepare("SELECT count(*) count FROM member_presence_windows").get().count, 0);
  assert.equal(db.prepare("SELECT count(*) count FROM trip_members WHERE trip_id = ? AND presence_coverage = 'unknown'").get("trip-shanghai-hangzhou-2026").count, 5);

  const lines = db.prepare(`SELECT l.id, l.amount_minor, sum(a.amount_minor) allocated
    FROM booking_cost_lines l JOIN booking_cost_allocations a ON a.cost_line_id = l.id
    GROUP BY l.id ORDER BY l.sort_order`).all();
  assert.deepEqual(lines.map((line) => ({ ...line })), [
    { id: "costline-hangzhou-hotel-first-night", amount_minor: 17100, allocated: 17100 },
    { id: "costline-hangzhou-hotel-last-two-nights", amount_minor: 58180, allocated: 58180 },
  ]);

  assert.equal(db.prepare("SELECT count(*) count FROM recommendations WHERE trip_id = ? AND is_core = 1 AND deleted_at IS NULL").get("trip-shanghai-hangzhou-2026").count, 8);
  assert.equal(db.prepare("SELECT count(*) count FROM recommendation_place_options").get().count, 3);
  assert.equal(db.prepare("SELECT count(*) count FROM itinerary_items WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count, 9);
  assert.equal(db.prepare("SELECT count(*) count FROM itinerary_items WHERE trip_id = ? AND locked_at IS NOT NULL").get("trip-shanghai-hangzhou-2026").count, 0);
  assert.equal(db.prepare("SELECT count(*) count FROM itinerary_items WHERE day_id = ?").get("trip-shanghai-hangzhou-2026-day-5").count, 0);
  assert.equal(db.prepare("SELECT place_id FROM itinerary_items WHERE id = ?").get("itinerary-shanghai-hangzhou-day3-caishen-temple").place_id, null);
});

test("E0C preserves Legacy compatibility rows and the test Trip", () => {
  assert.deepEqual(db.prepare("SELECT * FROM trip_places WHERE trip_id = ? ORDER BY place_id").all("trip-shanghai-hangzhou-2026").map((row) => ({ ...row })), legacyTripPlaces.map((row) => ({ ...row })));
  assert.deepEqual(db.prepare("SELECT * FROM day_places WHERE day_id LIKE 'trip-shanghai-hangzhou-2026-day-%' ORDER BY day_id, sort_order").all().map((row) => ({ ...row })), legacyDayPlaces.map((row) => ({ ...row })));
  assert.deepEqual({ ...db.prepare("SELECT * FROM trips WHERE slug = ?").get("trip-undated-bde38af5") }, { ...testTripBefore });
  assert.deepEqual(db.prepare("SELECT * FROM days WHERE trip_id = ? ORDER BY day_number").all(testTripBefore.id).map((row) => ({ ...row })), testDaysBefore.map((row) => ({ ...row })));
});

test("E0C is idempotent", () => {
  const before = {
    days: db.prepare("SELECT count(*) count FROM days WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
    bookings: db.prepare("SELECT count(*) count FROM bookings WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
    recommendations: db.prepare("SELECT count(*) count FROM recommendations WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
    allocations: db.prepare("SELECT count(*) count FROM booking_cost_allocations").get().count,
    items: db.prepare("SELECT count(*) count FROM itinerary_items WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
  };
  db.exec(e0cSql);
  const after = {
    days: db.prepare("SELECT count(*) count FROM days WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
    bookings: db.prepare("SELECT count(*) count FROM bookings WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
    recommendations: db.prepare("SELECT count(*) count FROM recommendations WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
    allocations: db.prepare("SELECT count(*) count FROM booking_cost_allocations").get().count,
    items: db.prepare("SELECT count(*) count FROM itinerary_items WHERE trip_id = ?").get("trip-shanghai-hangzhou-2026").count,
  };
  assert.deepEqual(after, before);
});
