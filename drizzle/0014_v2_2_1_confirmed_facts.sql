-- V2.2.1 confirmed production facts.  This migration is intentionally
-- additive and idempotent: it only records facts supplied by the traveller
-- and never guesses airport/place data.
INSERT OR IGNORE INTO booking_cost_lines (
  id, booking_id, title, service_start_date, service_end_date,
  amount_minor, currency, allocation_mode, sort_order, notes,
  created_at, updated_at
)
SELECT
  'booking-cost-flight-y87578',
  b.id,
  '深圳 → 上海机票',
  '2026-09-23',
  '2026-09-23',
  48000,
  'CNY',
  'custom',
  99,
  'nini承担；航班号 Y87578',
  '2026-09-02T00:00:00.000Z',
  '2026-09-02T00:00:00.000Z'
FROM bookings b
WHERE b.id = 'booking-shanghai-hangzhou-flight-szx-sha-20260923'
  AND b.type = 'flight'
  AND b.status = 'confirmed'
  AND b.total_amount_minor = 48000;
--> statement-breakpoint
UPDATE bookings
SET booking_reference = '航班号：Y87578',
    updated_at = '2026-09-02T00:00:00.000Z'
WHERE id = 'booking-shanghai-hangzhou-flight-szx-sha-20260923'
  AND type = 'flight'
  AND status = 'confirmed'
  AND total_amount_minor = 48000
  AND booking_reference IS NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO booking_participants (booking_id, member_id, role, created_at)
SELECT b.id, 'member-nini', 'covered', '2026-09-02T00:00:00.000Z'
FROM bookings b
JOIN members m ON m.id = 'member-nini'
WHERE b.id = 'booking-shanghai-hangzhou-flight-szx-sha-20260923'
  AND b.type = 'flight'
  AND b.status = 'confirmed';
--> statement-breakpoint
INSERT OR IGNORE INTO booking_cost_allocations (
  id, cost_line_id, member_id, amount_minor, notes, created_at, updated_at
)
SELECT
  'booking-cost-flight-y87578-nini',
  l.id,
  'member-nini',
  48000,
  '本人机票',
  '2026-09-02T00:00:00.000Z',
  '2026-09-02T00:00:00.000Z'
FROM booking_cost_lines l
JOIN members m ON m.id = 'member-nini'
WHERE l.id = 'booking-cost-flight-y87578'
  AND l.amount_minor = 48000
  AND l.allocation_mode = 'custom';
--> statement-breakpoint
UPDATE itinerary_items
SET time_mode = 'opening_hours',
    opening_hours_note = '营业时间待确认',
    start_time_local = NULL,
    end_time_local = NULL,
    duration_minutes = NULL,
    updated_at = '2026-09-02T00:00:00.000Z'
WHERE id IN (
  SELECT i.id
  FROM itinerary_items i
  WHERE i.day_id = 'trip-shanghai-hangzhou-2026-day-1'
    AND i.recommendation_id = 'recommendation-shanghai-disney'
)
  AND time_mode <> 'opening_hours';
