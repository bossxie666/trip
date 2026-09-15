-- Homepage Atlas city centers. Nullable by design: an unresolved AMap lookup
-- keeps the City/Trip relation valid while the Atlas omits that marker.
ALTER TABLE `cities` ADD COLUMN `center_lat` real;
ALTER TABLE `cities` ADD COLUMN `center_lng` real;
