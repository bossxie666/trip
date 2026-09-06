import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

class TestD1Statement {
  database: DatabaseSync; sql: string; values: SQLInputValue[];
  constructor(database: DatabaseSync, sql: string, values: SQLInputValue[] = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values: SQLInputValue[]) { return new TestD1Statement(this.database, this.sql, values); }
  async all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values) }; }
  async raw() { const statement = this.database.prepare(this.sql); statement.setReturnArrays(true); return statement.all(...this.values); }
  async run() { const result = this.database.prepare(this.sql).run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }, results: [] }; }
  async first(column?: string) { const row = (await this.all()).results[0] as Record<string, unknown> | undefined; return column && row ? row[column] : row ?? null; }
}

class TestD1Database {
  database = new DatabaseSync(":memory:");
  failBatchAt: number | null = null;
  constructor() { this.database.exec("PRAGMA foreign_keys = ON"); }
  prepare(sql: string) { return new TestD1Statement(this.database, sql); }
  async batch(statements: TestD1Statement[]) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const [index, statement] of statements.entries()) {
        if (this.failBatchAt === index) throw new Error("TEST_BATCH_FAILURE");
        results.push(await statement.all());
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.failBatchAt = null;
    }
  }
}

const DB = new TestD1Database();
(globalThis as typeof globalThis & { __TRIP_TEST_D1__?: unknown; __TRIP_TEST_ENV__?: Record<string, string> }).__TRIP_TEST_D1__ = DB;
for (const file of ["0000_strange_unus.sql", "0001_fancy_sharon_carter.sql", "0002_cynical_umar.sql", "0003_bright_prodigy.sql", "0004_clean_starfox.sql", "0005_omniscient_la_nuit.sql", "0006_right_queen_noir.sql", "0011_v2_1_stability.sql", "0012_rename_zhu_jingqi_display_name.sql", "0013_absurd_bastion.sql", "0015_v2_4_r1_booking_endpoint_labels.sql"]) {
  DB.database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
}

const now = "2026-09-01T00:00:00.000Z";
DB.database.exec(`
  INSERT INTO trips (id, slug, title, status, start_date, end_date, people, created_at, updated_at, timezone) VALUES
    ('trip-e0b-a','e0b-a','E0B A','planning','2027-01-01','2027-01-03',3,'${now}','${now}','Asia/Shanghai'),
    ('trip-e0b-b','e0b-b','E0B B','planning','2027-02-01','2027-02-01',1,'${now}','${now}','Asia/Shanghai');
  INSERT INTO trip_cities (trip_id, city_id, position) VALUES ('trip-e0b-a','city-shadow-shanghai',0),('trip-e0b-b','city-shadow-hangzhou',0);
  INSERT INTO trip_members (trip_id, member_id) VALUES
    ('trip-e0b-a','member-nini'),('trip-e0b-a','member-zhu-jingqi'),('trip-e0b-a','member-wang-jingwen'),('trip-e0b-b','member-nini');
  INSERT INTO days (id, trip_id, day_number, date, title, updated_at) VALUES
    ('e0b-a-day-1','trip-e0b-a',1,'2027-01-01','Day 1','${now}'),
    ('e0b-a-day-2','trip-e0b-a',2,'2027-01-02','Day 2','${now}'),
    ('e0b-a-day-3','trip-e0b-a',3,'2027-01-03','Day 3','${now}'),
    ('e0b-b-day-1','trip-e0b-b',1,'2027-02-01','Day 1','${now}');
  INSERT INTO trip_stages (id, trip_id, city_id, title, sort_order, created_at, updated_at) VALUES
    ('e0b-stage-a','trip-e0b-a','city-shadow-shanghai','A',1,'${now}','${now}'),
    ('e0b-stage-b','trip-e0b-b','city-shadow-hangzhou','B',1,'${now}','${now}');
  INSERT INTO places (id, name, city_id, provider, created_at, updated_at) VALUES
    ('e0b-place-a','地点A','city-shadow-shanghai','manual','${now}','${now}'),
    ('e0b-place-b','地点B','city-shadow-shanghai','manual','${now}','${now}'),
    ('e0b-place-other','外部地点','city-shadow-hangzhou','manual','${now}','${now}');
`);

const recommendationRepo = await import("../services/recommendation-repository.server.ts");
const bookingRepo = await import("../services/booking-repository.server.ts");
const itineraryRepo = await import("../services/itinerary-repository.server.ts");
const presenceRepo = await import("../services/presence-repository.server.ts");
const timelineService = await import("../services/day-timeline-service.server.ts");
const timelineAssembler = await import("../services/timeline-assembler.ts");
const dayLabel = await import("../services/day-label.ts");
const timelinePlacementRepo = await import("../services/timeline-placement-repository.server.ts");
const transitSteps = await import("../services/amap/transit-steps.ts");
const amapWebService = await import("../services/amap/amap-web-service.server.ts");
const transportEstimate = await import("../services/transport-estimate.ts");
const subwayColors = await import("../services/amap/subway-colors.ts");
const domain = await import("../services/planning-domain.mjs");

test("E0B data foundation", async (t) => {
  let recommendationId = "";
  let itemFromRecommendation = "";
  let bookingId = "";

  await t.test("creates Recommendation and alternative/component options", async () => {
    const recommendation = await recommendationRepo.createRecommendation({ tripId: "trip-e0b-a", kind: "guide", category: "experience", title: "城市攻略", isCore: true }, "member-nini");
    recommendationId = recommendation.id;
    await recommendationRepo.addRecommendationPlaceOption({ recommendationId, placeId: "e0b-place-a", relationType: "alternative", sortOrder: 1, isPrimary: true });
    await recommendationRepo.addRecommendationPlaceOption({ recommendationId, placeId: "e0b-place-b", relationType: "component", sortOrder: 1 });
    await recommendationRepo.setRecommendationFavorite(recommendationId, "member-nini", true);
    assert.equal((DB.database.prepare("SELECT is_favorite FROM recommendation_member_states WHERE recommendation_id = ? AND member_id = 'member-nini'").get(recommendationId) as { is_favorite: number }).is_favorite, 1);
    const types = DB.database.prepare("SELECT relation_type FROM recommendation_place_options WHERE recommendation_id = ? ORDER BY relation_type").all(recommendationId).map((row) => row.relation_type);
    assert.deepEqual(types, ["alternative", "component"]);
    await assert.rejects(() => recommendationRepo.addRecommendationPlaceOption({ recommendationId, placeId: "e0b-place-other", relationType: "alternative", sortOrder: 2 }), /PLACE_NOT_IN_TRIP_CITY/);
  });

  await t.test("creates nullable-place Item from Recommendation and preserves it after soft delete", async () => {
    const item = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", recommendationId, itemType: "activity", title: "待确定地点" }, "member-nini");
    itemFromRecommendation = item.id;
    assert.equal(item.placeId, null);
    assert.equal(await recommendationRepo.softDeleteRecommendation(recommendationId, "member-nini"), true);
    assert.equal((DB.database.prepare("SELECT count(*) count FROM itinerary_items WHERE id = ? AND recommendation_id = ?").get(item.id, recommendationId) as { count: number }).count, 1);
    assert.equal((await recommendationRepo.listRecommendations("trip-e0b-a")).length, 0);
  });

  await t.test("rejects cross-Trip Day and Stage while allowing shared source material and reusable Places", async () => {
    const otherRecommendation = await recommendationRepo.createRecommendation({ tripId: "trip-e0b-b", kind: "place", category: "attraction", title: "另一 Trip 素材" }, "member-nini");
    await assert.rejects(() => itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-b-day-1", itemType: "note", title: "错 Day" }, "member-nini"), /DAY_NOT_IN_TRIP/);
    await assert.rejects(() => itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", stageId: "e0b-stage-b", itemType: "note", title: "错 Stage" }, "member-nini"), /STAGE_NOT_IN_TRIP/);
    const shared = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-2", recommendationId: otherRecommendation.id, itemType: "activity", title: "共享素材" }, "member-nini");
    const reusedPlace = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-2", placeId: "e0b-place-other", itemType: "place", title: "复用 Place" }, "member-nini");
    assert.equal(shared.recommendationId, otherRecommendation.id);
    assert.equal(reusedPlace.placeId, "e0b-place-other");
    assert.equal((DB.database.prepare("SELECT count(*) count FROM trip_cities WHERE trip_id = 'trip-e0b-a' AND city_id = 'city-shadow-hangzhou'").get() as { count: number }).count, 1);
  });

  await t.test("creates Booking and participant while protecting confirmed hard delete", async () => {
    const booking = await bookingRepo.createBooking({ tripId: "trip-e0b-a", type: "hotel", status: "confirmed", title: "测试酒店", temporalKind: "date_range", startDateLocal: "2027-01-01", endDateLocal: "2027-01-03", timezone: "Asia/Shanghai", totalAmountMinor: 10000, currency: "CNY", participantMemberIds: ["member-nini", "member-zhu-jingqi"] }, "member-nini");
    bookingId = booking.id;
    assert.equal((DB.database.prepare("SELECT count(*) count FROM booking_participants WHERE booking_id = ?").get(bookingId) as { count: number }).count, 2);
    await assert.rejects(() => bookingRepo.deleteBooking(bookingId, { hard: true }), /BOOKING_HARD_DELETE_PROTECTED/);
  });

  await t.test("performs stable equal split and validated custom split", async () => {
    const equal = await bookingRepo.createBookingCostLine({ bookingId, title: "均摊", amountMinor: 10000, currency: "CNY", allocationMode: "equal", sortOrder: 1 });
    const first = await bookingRepo.replaceCostAllocations(equal.id, ["member-wang-jingwen", "member-nini", "member-zhu-jingqi"]);
    assert.deepEqual(first.map((row) => [row.memberId, row.amountMinor]), [["member-nini", 3334], ["member-wang-jingwen", 3333], ["member-zhu-jingqi", 3333]]);
    const second = await bookingRepo.replaceCostAllocations(equal.id, ["member-zhu-jingqi", "member-wang-jingwen", "member-nini"]);
    assert.deepEqual(second.map((row) => [row.memberId, row.amountMinor]), first.map((row) => [row.memberId, row.amountMinor]));
    const custom = await bookingRepo.createBookingCostLine({ bookingId, title: "自定义", amountMinor: 10000, currency: "CNY", allocationMode: "custom", sortOrder: 2 });
    await assert.rejects(() => bookingRepo.replaceCostAllocations(custom.id, [{ memberId: "member-nini", amountMinor: 9999 }]), /ALLOCATION_TOTAL_MISMATCH/);
    const saved = await bookingRepo.replaceCostAllocations(custom.id, [{ memberId: "member-nini", amountMinor: 7000 }, { memberId: "member-zhu-jingqi", amountMinor: 3000 }]);
    assert.equal(saved.reduce((sum, row) => sum + row.amountMinor, 0), 10000);
    const modeBooking = await bookingRepo.createBooking({ tripId: "trip-e0b-a", type: "hotel", status: "confirmed", title: "切换分摊模式", temporalKind: "date_range", startDateLocal: "2027-01-02", endDateLocal: "2027-01-03", timezone: "Asia/Shanghai", totalAmountMinor: 10000, currency: "CNY", participantMemberIds: ["member-nini", "member-zhu-jingqi"] }, "member-nini");
    const modeLine = await bookingRepo.createBookingCostLine({ bookingId: modeBooking.id, title: "房费", amountMinor: 10000, currency: "CNY", allocationMode: "equal", sortOrder: 1 });
    await bookingRepo.replaceCostAllocations(modeLine.id, ["member-nini", "member-zhu-jingqi"]);
    await bookingRepo.updateBooking(modeBooking.id, { costLineAllocations: [{ costLineId: modeLine.id, allocationMode: "custom", allocations: [{ memberId: "member-nini", amountMinor: 6000 }, { memberId: "member-zhu-jingqi", amountMinor: 4000 }] }] }, "member-nini", "e0b-a");
    assert.equal((DB.database.prepare("SELECT allocation_mode FROM booking_cost_lines WHERE id = ?").get(modeLine.id) as { allocation_mode: string }).allocation_mode, "custom");
    assert.deepEqual(DB.database.prepare("SELECT member_id, amount_minor FROM booking_cost_allocations WHERE cost_line_id = ? ORDER BY member_id").all(modeLine.id).map((row) => ({ ...row })), [{ member_id: "member-nini", amount_minor: 6000 }, { member_id: "member-zhu-jingqi", amount_minor: 4000 }]);
  });

  await t.test("clears and rebinds one transport endpoint without changing the other Booking facts", async () => {
    const transport = await bookingRepo.createBooking({
      tripId: "trip-e0b-a", type: "flight", status: "tentative", title: "Y8 测试航班", temporalKind: "interval",
      startAt: "2027-01-01T00:35:00.000Z", endAt: "2027-01-01T02:55:00.000Z", startDateLocal: "2027-01-01", endDateLocal: "2027-01-01", timezone: "Asia/Shanghai",
      originPlaceId: "e0b-place-a", destinationPlaceId: "e0b-place-other", originLabel: "深圳宝安国际机场", destinationLabel: "上海浦东国际机场",
      totalAmountMinor: 48000, currency: "CNY", bookingReference: "Y8TEST", notes: "保留行李备注", participantMemberIds: ["member-nini", "member-zhu-jingqi"],
    }, "member-nini");
    const line = await bookingRepo.createBookingCostLine({ bookingId: transport.id, title: "机票", amountMinor: 48000, currency: "CNY", allocationMode: "equal", sortOrder: 1 });
    await bookingRepo.replaceCostAllocations(line.id, ["member-nini", "member-zhu-jingqi"]);
    const invariantSql = "SELECT title, status, start_at, end_at, start_date_local, end_date_local, origin_place_id, destination_place_id, origin_label, destination_label, total_amount_minor, currency, booking_reference, notes FROM bookings WHERE id = ?";
    const before = DB.database.prepare(invariantSql).get(transport.id) as Record<string, unknown>;
    const participantsBefore = DB.database.prepare("SELECT member_id FROM booking_participants WHERE booking_id = ? ORDER BY member_id").all(transport.id);
    const allocationsBefore = DB.database.prepare("SELECT member_id, amount_minor FROM booking_cost_allocations WHERE cost_line_id = ? ORDER BY member_id").all(line.id);

    await bookingRepo.updateBooking(transport.id, { destinationPlaceId: null }, "member-nini", "e0b-a");
    const cleared = DB.database.prepare(invariantSql).get(transport.id) as Record<string, unknown>;
    assert.equal(cleared.destination_place_id, null);
    assert.deepEqual({ ...cleared, destination_place_id: before.destination_place_id }, { ...before });
    assert.deepEqual(DB.database.prepare("SELECT member_id FROM booking_participants WHERE booking_id = ? ORDER BY member_id").all(transport.id), participantsBefore);
    assert.deepEqual(DB.database.prepare("SELECT member_id, amount_minor FROM booking_cost_allocations WHERE cost_line_id = ? ORDER BY member_id").all(line.id), allocationsBefore);

    await bookingRepo.updateBooking(transport.id, { destinationPlaceId: "e0b-place-b" }, "member-nini", "e0b-a");
    const rebound = DB.database.prepare(invariantSql).get(transport.id) as Record<string, unknown>;
    assert.equal(rebound.destination_place_id, "e0b-place-b");
    assert.equal(rebound.destination_label, "上海浦东国际机场");
  });

  await t.test("edits and soft-deletes accommodation while preserving its Place and ordinary hotel Items", async () => {
    const hotel = await bookingRepo.createBooking({
      tripId: "trip-e0b-a", type: "hotel", status: "confirmed", title: "测试住宿", temporalKind: "date_range",
      startDateLocal: "2027-01-01", endDateLocal: "2027-01-03", timezone: "Asia/Shanghai", placeId: "e0b-place-a",
      totalAmountMinor: 9000, currency: "CNY", notes: "原备注", participantMemberIds: ["member-nini", "member-zhu-jingqi"],
    }, "member-nini");
    const hotelLine = await bookingRepo.createBookingCostLine({ bookingId: hotel.id, title: "房费", amountMinor: 9000, currency: "CNY", allocationMode: "equal", sortOrder: 1 });
    await bookingRepo.replaceCostAllocations(hotelLine.id, ["member-nini", "member-zhu-jingqi"]);
    const hotelItem = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-2", placeId: "e0b-place-a", itemType: "lodging", title: "回酒店休息" }, "member-nini");

    await bookingRepo.updateBooking(hotel.id, {
      title: "新住宿名", status: "tentative", startDateLocal: "2027-01-02", endDateLocal: "2027-01-03", placeId: "e0b-place-b",
      totalAmountMinor: 12000, currency: "CNY", participantMemberIds: ["member-nini"], notes: "新备注",
    }, "member-nini", "e0b-a");
    const edited = DB.database.prepare("SELECT title, status, start_date_local, end_date_local, place_id, total_amount_minor, notes FROM bookings WHERE id = ?").get(hotel.id);
    assert.deepEqual({ ...edited }, { title: "新住宿名", status: "tentative", start_date_local: "2027-01-02", end_date_local: "2027-01-03", place_id: "e0b-place-b", total_amount_minor: 12000, notes: "新备注" });
    assert.deepEqual(DB.database.prepare("SELECT member_id FROM booking_participants WHERE booking_id = ?").all(hotel.id).map((row) => ({ ...row })), [{ member_id: "member-nini" }]);
    assert.equal((DB.database.prepare("SELECT SUM(amount_minor) total FROM booking_cost_allocations WHERE cost_line_id = ?").get(hotelLine.id) as { total: number }).total, 12000);

    assert.equal(await bookingRepo.deleteBooking(hotel.id), true);
    assert.ok((DB.database.prepare("SELECT deleted_at FROM bookings WHERE id = ?").get(hotel.id) as { deleted_at: string | null }).deleted_at);
    assert.equal((DB.database.prepare("SELECT count(*) count FROM places WHERE id IN ('e0b-place-a','e0b-place-b')").get() as { count: number }).count, 2);
    assert.equal((DB.database.prepare("SELECT count(*) count FROM itinerary_items WHERE id = ? AND place_id = 'e0b-place-a'").get(hotelItem.id) as { count: number }).count, 1);
  });

  await t.test("returns presence unknown/present/absent and rejects overlap", async () => {
    await presenceRepo.createPresenceWindow({ tripId: "trip-e0b-a", memberId: "member-zhu-jingqi", stageId: "e0b-stage-a", startsAt: "2027-01-02T02:00:00.000Z", endsAt: "2027-01-03T02:00:00.000Z", timezone: "Asia/Shanghai" }, "member-nini");
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-zhu-jingqi", "2027-01-02T03:00:00.000Z"), "unknown");
    await presenceRepo.setPresenceCoverage("trip-e0b-a", "member-zhu-jingqi", "complete");
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-zhu-jingqi", "2027-01-02T03:00:00.000Z"), "present");
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-zhu-jingqi", "2027-01-01T03:00:00.000Z"), "absent");
    await assert.rejects(() => presenceRepo.createPresenceWindow({ tripId: "trip-e0b-a", memberId: "member-zhu-jingqi", startsAt: "2027-01-02T04:00:00.000Z", endsAt: "2027-01-02T05:00:00.000Z", timezone: "Asia/Shanghai" }, "member-nini"), /PRESENCE_OVERLAP/);
    await itineraryRepo.setItineraryParticipantOverride({ itineraryItemId: itemFromRecommendation, memberId: "member-nini", participation: "included" });
    const participants = await presenceRepo.resolveItineraryParticipants(itemFromRecommendation, null);
    assert.equal(participants.find((entry) => entry.memberId === "member-nini")?.state, "present");
    assert.equal(participants.find((entry) => entry.memberId === "member-wang-jingwen")?.state, "unknown");
  });

  await t.test("keeps explicit Day presence scoped to its Day and supports partial presence", async () => {
    await presenceRepo.replaceDayPresence({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", members: [
      { memberId: "member-nini", state: "present" },
      { memberId: "member-zhu-jingqi", state: "absent" },
      { memberId: "member-wang-jingwen", state: "partial", startsAt: "12:00", endsAt: "18:00" },
    ], actorMemberId: "member-nini" });
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-zhu-jingqi", "2027-01-01T08:00:00.000Z"), "absent");
    // A Day 1 absence must not leak into Day 2, where the existing window is active.
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-zhu-jingqi", "2027-01-02T03:00:00.000Z"), "present");
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-wang-jingwen", "2027-01-01T03:00:00.000Z"), "absent");
    assert.equal(await presenceRepo.getPresenceState("trip-e0b-a", "member-wang-jingwen", "2027-01-01T05:00:00.000Z"), "present");
  });

  await t.test("reorders atomically without touching day_places", async () => {
    const item2 = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", itemType: "note", title: "二" }, "member-nini");
    const item3 = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", itemType: "note", title: "三" }, "member-nini");
    const otherDayItem = await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-2", itemType: "note", title: "别日" }, "member-nini");
    const legacyBefore = (DB.database.prepare("SELECT count(*) count FROM day_places").get() as { count: number }).count;
    assert.deepEqual((await itineraryRepo.reorderItineraryItems("trip-e0b-a", "e0b-a-day-1", [item2.id, itemFromRecommendation, item3.id])).map((row) => row.id), [item2.id, itemFromRecommendation, item3.id]);
    assert.deepEqual((await itineraryRepo.reorderItineraryItems("trip-e0b-a", "e0b-a-day-1", [item3.id, item2.id, itemFromRecommendation])).map((row) => row.id), [item3.id, item2.id, itemFromRecommendation]);
    await assert.rejects(() => itineraryRepo.reorderItineraryItems("trip-e0b-a", "e0b-a-day-1", [item3.id, item3.id, itemFromRecommendation]), /INVALID_ORDER/);
    await assert.rejects(() => itineraryRepo.reorderItineraryItems("trip-e0b-a", "e0b-a-day-1", [item3.id, item2.id, "missing"]), /INVALID_ORDER/);
    await assert.rejects(() => itineraryRepo.reorderItineraryItems("trip-e0b-a", "e0b-a-day-1", [item3.id, item2.id, otherDayItem.id]), /INVALID_ORDER/);
    const beforeFailure = (await itineraryRepo.listItineraryItems("e0b-a-day-1")).map((row) => [row.id, row.sortOrder]);
    DB.failBatchAt = 2;
    await assert.rejects(() => itineraryRepo.reorderItineraryItems("trip-e0b-a", "e0b-a-day-1", [itemFromRecommendation, item2.id, item3.id]), /TEST_BATCH_FAILURE/);
    assert.deepEqual((await itineraryRepo.listItineraryItems("e0b-a-day-1")).map((row) => [row.id, row.sortOrder]), beforeFailure);
    assert.equal((DB.database.prepare("SELECT count(*) count FROM day_places").get() as { count: number }).count, legacyBefore);
    assert.equal((DB.database.prepare("SELECT count(*) count FROM trip_places WHERE trip_id = 'trip-e0b-a'").get() as { count: number }).count, 0);
  });

  await t.test("builds deterministic Booking + Item timeline without accommodation anchors", async () => {
    await bookingRepo.createBooking({ tripId: "trip-e0b-a", type: "train", status: "confirmed", title: "08点列车", temporalKind: "interval", startAt: "2027-01-01T00:00:00.000Z", endAt: "2027-01-01T01:00:00.000Z", timezone: "Asia/Shanghai", participantMemberIds: ["member-nini"] }, "member-nini");
    await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", itemType: "activity", title: "08点活动", startTimeLocal: "08:00" }, "member-nini");
    const day1 = await timelineService.getDayTimeline("trip-e0b-a", "e0b-a-day-1");
    assert.equal(day1[0].source, "booking");
    assert.equal(day1[0].anchorKind, "timed");
    const timed = day1.filter((entry) => entry.bucket === "timed");
    assert.equal(timed[0].source, "booking");
    assert.equal(timed[1].source, "itinerary");
    const day2 = await timelineService.getDayTimeline("trip-e0b-a", "e0b-a-day-2");
    assert.equal(day2.some((entry) => entry.source === "booking" && entry.anchorKind), false);
    const day3 = await timelineService.getDayTimeline("trip-e0b-a", "e0b-a-day-3");
    assert.equal(day3.some((entry) => entry.source === "booking" && entry.anchorKind), false);
  });

  await t.test("persists mixed Booking Anchor placement without changing Booking facts", async () => {
    const beforeBooking = DB.database.prepare("SELECT start_at, end_at, total_amount_minor FROM bookings WHERE title = '08点列车'").get();
    const baseline = await timelineService.getDayTimeline("trip-e0b-a", "e0b-a-day-1");
    const requested = [...baseline].reverse().map((entry) => ({ source: entry.source, sourceId: entry.sourceId, anchorKind: entry.anchorKind }));
    const placed = await timelinePlacementRepo.replaceDayTimelinePositions({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", entries: requested, actorMemberId: "member-nini" });
    assert.deepEqual(placed.map((entry) => `${entry.source}:${entry.sourceId}:${entry.anchorKind || ""}`), requested.map((entry) => `${entry.source}:${entry.sourceId}:${entry.anchorKind || ""}`));
    assert.deepEqual(DB.database.prepare("SELECT start_at, end_at, total_amount_minor FROM bookings WHERE title = '08点列车'").get(), beforeBooking);
  });

  await t.test("aggregates transit legs and removes empty station steps", () => {
    const result = transitSteps.aggregateTransitSteps([
      { mode: "walking", instruction: "起点", lineName: null, direction: null, stationCount: null, fromStation: null, toStation: "首站", transfer: null, durationSeconds: 120, distanceMeters: 180, polyline: [] },
      { mode: "subway", instruction: null, lineName: "2号线", direction: "徐泾东方向", stationCount: 3, fromStation: "首站", toStation: "世纪大道", transfer: null, durationSeconds: 600, distanceMeters: 2600, polyline: [] },
      { mode: "subway", instruction: null, lineName: "2号线", direction: "徐泾东方向", stationCount: 2, fromStation: "世纪大道", toStation: "人民广场", transfer: null, durationSeconds: 360, distanceMeters: 1500, polyline: [] },
      { mode: "bus", instruction: null, lineName: "", direction: null, stationCount: 0, fromStation: null, toStation: null, transfer: null, durationSeconds: 0, distanceMeters: 0, polyline: [] },
      { mode: "walking", instruction: "下车后", lineName: null, direction: null, stationCount: null, fromStation: null, toStation: "终点", transfer: null, durationSeconds: 180, distanceMeters: 260, polyline: [] },
    ]);
    assert.deepEqual(result.map((step) => [step.mode, step.lineName, step.stationCount]), [["walking", null, null], ["subway", "2号线", 5], ["walking", null, null]]);
    assert.equal(result.some((step) => step.stationCount === 0), false);
  });

  await t.test("parses ordered walking, subway, bus and transfer legs", () => {
    const result = amapWebService.normalizeTransitSteps({
      walking: [{ instruction: "步行至人民广场站", distance: "300", duration: "180" }],
      railway: [{ route_name: "2号线", direction: "浦东国际机场方向", departure_stop: { name: "人民广场" }, arrival_stop: { name: "世纪大道" }, station_count: "3", distance: "2500", duration: "600" }],
      bus: [{ route_name: "123路", direction: "外滩方向", departure_stop: { name: "世纪大道" }, arrival_stop: { name: "外滩" }, station_count: "4", distance: "2100", duration: "500" }],
      transfers: [{ name: "换乘" }],
    });
    assert.deepEqual(result.map((step) => step.mode), ["walking", "subway", "bus", "other"]);
    assert.deepEqual(result.slice(1, 3).map((step) => [step.fromStation, step.lineName, step.direction, step.stationCount, step.toStation]), [
      ["人民广场", "2号线", "浦东国际机场方向", 3, "世纪大道"],
      ["世纪大道", "123路", "外滩方向", 4, "外滩"],
    ]);
    assert.equal(result.some((step) => step.stationCount === 0), false);
  });

  await t.test("keeps transport estimates participant-aware and cycling free", () => {
    const memberStates = { "member-nini": "present" as const, "member-wang-jingwen": "present" as const, "member-zhu-jingqi": "present" as const, "member-liu-xu": "present" as const };
    assert.deepEqual(transportEstimate.estimateTransportCost({ mode: "transit", transitCost: 7, memberId: "member-nini", memberStates }), { amountMinor: 700, pending: false, participantCount: 1 });
    assert.equal(transportEstimate.estimateTransportCost({ mode: "taxi", taxiCost: 120, memberId: "member-nini", memberStates }).amountMinor, 3000);
    assert.equal(transportEstimate.estimateTransportCost({ mode: "walking", memberId: "member-nini", memberStates }).amountMinor, 0);
    assert.equal(transportEstimate.estimateTransportCost({ mode: "bicycling", memberId: "member-nini", memberStates }).amountMinor, 0);
    assert.equal(transportEstimate.estimateTransportCost({ mode: "taxi", taxiCost: 120, memberId: "member-nini", memberStates: { "member-nini": "present", "member-wang-jingwen": "unknown" } }).pending, true);
    assert.equal(transportEstimate.mergeTransportParticipantStates({ "member-nini": "present" }, { "member-nini": "unknown" })["member-nini"], "unknown");
  });

  await t.test("uses city-scoped subway colors and a neutral fallback", () => {
    assert.notEqual(subwayColors.subwayLineColor("Shanghai", "2号线"), subwayColors.subwayLineColor("Hangzhou", "2号线"));
    assert.equal(subwayColors.subwayLineColor("Shanghai", "99号线"), subwayColors.SUBWAY_NEUTRAL);
    assert.equal(subwayColors.routeStrokeColor("bus", [], "Shanghai"), subwayColors.BUS_NEUTRAL);
    assert.equal(subwayColors.routeStrokeColor("transit", [{ mode: "subway", lineName: "2号线" }], "Shanghai"), subwayColors.subwayLineColor("Shanghai", "2号线"));
  });

  await t.test("assembles one deterministic Node → Edge → Node timeline", () => {
    const place = (id: string, cityId = "city-shadow-shanghai") => ({ id, name: id, cityId, address: null, latitude: 31, longitude: 121 });
    const assembly = timelineAssembler.assembleDayTimeline({
      day: { id: "timeline-day", date: "2027-01-01" },
      items: [
        { id: "timeline-a", dayId: "timeline-day", title: "出发前地点", sortOrder: 1, place: place("timeline-a"), startTimeLocal: "07:00" },
        { id: "timeline-during", dayId: "timeline-day", title: "航班期间误排事项", sortOrder: 2, place: place("timeline-during"), startTimeLocal: "08:30" },
        { id: "timeline-b", dayId: "timeline-day", title: "迪士尼", sortOrder: 3, place: place("timeline-b"), startTimeLocal: "10:00" },
        { id: "timeline-repeat", dayId: "timeline-day", title: "再次到访", sortOrder: 4, place: place("timeline-b"), startTimeLocal: "11:00" },
      ],
      bookings: [{ id: "timeline-flight", title: "航班", type: "flight", startDateLocal: "2027-01-01", endDateLocal: "2027-01-01", startAt: "2027-01-01T00:00:00.000Z", endAt: "2027-01-01T01:00:00.000Z", timezone: "Asia/Shanghai", originPlace: place("timeline-origin"), destinationPlace: place("timeline-destination", "city-shadow-hangzhou") }],
    });
    assert.deepEqual(assembly.nodes.map((node) => node.id), ["timeline-a", "timeline-flight:origin", "timeline-flight:destination", "timeline-during", "timeline-b", "timeline-repeat"]);
    assert.deepEqual(assembly.longDistanceEdges.map((edge) => [edge.from.id, edge.to.id]), [["timeline-flight:origin", "timeline-flight:destination"]]);
    assert.equal(assembly.localEdges.some((edge) => edge.from.endpoint === "origin" || edge.to.endpoint === "destination"), false);
    assert.deepEqual(assembly.localEdges.map((edge) => [edge.from.id, edge.to.id]), [["timeline-a", "timeline-flight:origin"], ["timeline-flight:destination", "timeline-during"], ["timeline-during", "timeline-b"], ["timeline-b", "timeline-repeat"]]);
    assert.notEqual(assembly.nodes.find((node) => node.id === "timeline-b"), assembly.nodes.find((node) => node.id === "timeline-repeat"));

    const blocked = timelineAssembler.assembleDayTimeline({
      day: { id: "blocked-day", date: "2027-01-01" },
      items: [
        { id: "blocked-a", dayId: "blocked-day", title: "A", sortOrder: 1, place: place("blocked-a") },
        { id: "blocked-note", dayId: "blocked-day", title: "待确认事项", sortOrder: 2, place: null },
        { id: "blocked-b", dayId: "blocked-day", title: "B", sortOrder: 3, place: place("blocked-b") },
      ],
      bookings: [],
    });
    assert.equal(blocked.localEdges.some((edge) => edge.from.id === "blocked-a" && edge.to.id === "blocked-b"), false);

    const hotelDoesNotRoute = timelineAssembler.assembleDayTimeline({
      day: { id: "hotel-day", date: "2027-01-01" },
      items: [
        { id: "hotel-route-a", dayId: "hotel-day", title: "A", sortOrder: 1, place: place("hotel-route-a") },
        { id: "hotel-route-b", dayId: "hotel-day", title: "B", sortOrder: 2, place: place("hotel-route-b") },
      ],
      bookings: [{ id: "hotel-booking", title: "住宿", type: "hotel", startDateLocal: "2027-01-01", endDateLocal: "2027-01-02", originPlace: null, destinationPlace: null }],
    });
    assert.equal(hotelDoesNotRoute.nodes.some((node) => node.bookingId === "hotel-booking"), false);
    assert.deepEqual(hotelDoesNotRoute.localEdges.map((edge) => [edge.from.id, edge.to.id]), [["hotel-route-a", "hotel-route-b"]]);
  });

  await t.test("clears stale incomplete Day presence when state becomes present", async () => {
    DB.database.prepare("UPDATE day_member_presence SET state = 'partial', starts_at = ?, ends_at = NULL WHERE day_id = 'e0b-a-day-1' AND member_id = 'member-wang-jingwen'").run("2027-01-01T04:00:00.000Z");
    await assert.rejects(() => presenceRepo.replaceDayPresence({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", members: [
      { memberId: "member-nini", state: "present" },
      { memberId: "member-zhu-jingqi", state: "absent" },
      { memberId: "member-wang-jingwen", state: "partial" },
    ], actorMemberId: "member-nini" }), /INCOMPLETE_PRESENCE:member-wang-jingwen/);
    await presenceRepo.replaceDayPresence({ tripId: "trip-e0b-a", dayId: "e0b-a-day-1", members: [
      { memberId: "member-nini", state: "present" },
      { memberId: "member-zhu-jingqi", state: "absent" },
      { memberId: "member-wang-jingwen", state: "present" },
    ], actorMemberId: "member-nini" });
    const row = DB.database.prepare("SELECT state, starts_at, ends_at FROM day_member_presence WHERE day_id = 'e0b-a-day-1' AND member_id = 'member-wang-jingwen'").get();
    assert.deepEqual({ ...row }, { state: "present", starts_at: "2026-12-31T16:00:00.000Z", ends_at: "2027-01-01T16:00:00.000Z" });
  });

  await t.test("uses the default timezone when a legacy Trip has no timezone", async () => {
    const previous = (DB.database.prepare("SELECT timezone FROM trips WHERE id = 'trip-e0b-a'").get() as { timezone: string | null }).timezone;
    DB.database.prepare("UPDATE trips SET timezone = NULL WHERE id = 'trip-e0b-a'").run();
    try {
      await presenceRepo.replaceDayPresence({ tripId: "trip-e0b-a", dayId: "e0b-a-day-3", members: [
        { memberId: "member-nini", state: "present" },
        { memberId: "member-zhu-jingqi", state: "absent" },
        { memberId: "member-wang-jingwen", state: "partial", startsAt: "10:00", endsAt: "12:00" },
      ], actorMemberId: "member-nini" });
      const row = DB.database.prepare("SELECT state, starts_at, ends_at FROM day_member_presence WHERE day_id = 'e0b-a-day-3' AND member_id = 'member-wang-jingwen'").get();
      assert.deepEqual({ ...row }, { state: "partial", starts_at: "2027-01-03T02:00:00.000Z", ends_at: "2027-01-03T04:00:00.000Z" });
    } finally {
      DB.database.prepare("UPDATE trips SET timezone = ? WHERE id = 'trip-e0b-a'").run(previous);
    }
  });

  await t.test("uses reliable endpoint cities for Day labels and safe Day fallback", () => {
    const cities = [{ id: "city-shadow-shanghai", name: "上海" }, { id: "city-shadow-hangzhou", name: "杭州" }];
    assert.equal(dayLabel.resolveDayLabel({ id: "label-day", dayNumber: 1, date: "2027-01-01", title: "上海→杭州" }, [], cities), "Day 1");
    assert.equal(dayLabel.resolveDayLabel({ id: "label-day", dayNumber: 1, date: "2027-01-01", title: "错误旧标题" }, [{ type: "flight", startDateLocal: "2027-01-01", endDateLocal: "2027-01-01", originPlace: { cityId: "city-shadow-shanghai" }, destinationPlace: { cityId: "city-shadow-hangzhou" } }], cities), "上海→杭州");
    assert.equal(dayLabel.resolveDayLabel({ id: "label-day", dayNumber: 1, date: "2027-01-01", title: "错误旧标题" }, [{ type: "flight", startDateLocal: "2027-01-01", endDateLocal: "2027-01-01", originLabel: "深圳", destinationLabel: "上海" }], cities), "深圳→上海");
    assert.equal(dayLabel.resolveDayLabel({ id: "label-day", dayNumber: 1, date: "2027-01-01", title: "错误旧标题" }, [
      { type: "flight", startDateLocal: "2027-01-01", originLabel: "深圳", destinationLabel: "上海" },
      { type: "train", startDateLocal: "2027-01-01", originLabel: "广州", destinationLabel: "上海" },
    ], cities), "Day 1");
  });

  await t.test("supports all itinerary time modes through the database", async () => {
    const modes = [
      ["untimed", null, null], ["start_only", "09:00", null], ["range", "10:00", "11:00"], ["all_day", null, null], ["opening_hours", null, null],
    ] as const;
    for (const [timeMode, startTimeLocal, endTimeLocal] of modes) {
      await itineraryRepo.createItineraryItem({ tripId: "trip-e0b-a", dayId: "e0b-a-day-3", itemType: "activity", title: `时间 ${timeMode}`, timeMode, startTimeLocal, endTimeLocal, openingHoursNote: timeMode === "opening_hours" ? "营业时间待确认" : null }, "member-nini");
    }
    const savedModes = DB.database.prepare("SELECT time_mode, start_time_local, end_time_local, opening_hours_note FROM itinerary_items WHERE day_id = 'e0b-a-day-3' AND title LIKE '时间 %' ORDER BY sort_order").all();
    assert.deepEqual(savedModes.map((row) => row.time_mode), modes.map(([timeMode]) => timeMode));
    assert.equal(savedModes.at(-1)?.opening_hours_note, "营业时间待确认");
  });

  await t.test("domain validation rejects floats and preserves stable tie breaks", () => {
    assert.throws(() => domain.assertMinorAmount(1.5), /INVALID_AMOUNT/);
    const timeline = domain.buildDayTimeline({ dayDate: "2027-01-01", timezone: "Asia/Shanghai", bookings: [], items: [{ id: "b", title: "B", startTimeLocal: null, sortOrder: 1, lockedAt: null }, { id: "a", title: "A", startTimeLocal: null, sortOrder: 1, lockedAt: null }] });
    assert.deepEqual(timeline.map((entry) => entry.sourceId), ["a", "b"]);
  });
});
