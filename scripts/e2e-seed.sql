INSERT OR IGNORE INTO members (id, name, display_name, active, created_at, role, credential_status)
VALUES ('member-nini', 'nini', 'nini', 1, '2026-01-01T00:00:00.000Z', 'admin', 'legacy');

INSERT OR IGNORE INTO trips (id, slug, title, status, start_date, end_date, people, cover, timezone, created_at, updated_at, protected, created_by_member_id, updated_by_member_id)
VALUES ('trip-e2e', 'e2e-shanghai', '上海测试旅行', 'planning', '2026-10-01', '2026-10-02', 1, NULL, 'Asia/Shanghai', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0, 'member-nini', 'member-nini');

INSERT OR IGNORE INTO trip_members (trip_id, member_id, presence_coverage)
VALUES ('trip-e2e', 'member-nini', 'unknown');

INSERT OR IGNORE INTO trip_cities (trip_id, city_id, position)
VALUES ('trip-e2e', 'city-shadow-shanghai', 0);

INSERT OR IGNORE INTO days (id, trip_id, day_number, date, title, updated_at)
VALUES
  ('trip-e2e-day-1', 'trip-e2e', 1, '2026-10-01', 'Day 1', NULL),
  ('trip-e2e-day-2', 'trip-e2e', 2, '2026-10-02', 'Day 2', NULL);
