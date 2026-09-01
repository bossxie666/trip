-- Retire only the old Shanghai/Hangzhou planning relationships.  The formal
-- E0C/E1 model (days, bookings, recommendations, itinerary_items and places)
-- remains untouched, as do every other trip's compatibility rows.
DELETE FROM `day_places`
WHERE `day_id` IN (
  SELECT `id` FROM `days` WHERE `trip_id` = 'trip-shanghai-hangzhou-2026'
);
--> statement-breakpoint
DELETE FROM `trip_places`
WHERE `trip_id` = 'trip-shanghai-hangzhou-2026';
--> statement-breakpoint
PRAGMA optimize;
