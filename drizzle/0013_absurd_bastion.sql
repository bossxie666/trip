-- V2.2 additive planning contract
ALTER TABLE `itinerary_items` ADD COLUMN `end_time_local` text;
--> statement-breakpoint
ALTER TABLE `itinerary_items` ADD COLUMN `time_mode` text NOT NULL DEFAULT 'untimed';
--> statement-breakpoint
ALTER TABLE `itinerary_items` ADD COLUMN `opening_hours_note` text;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD COLUMN `price_min_minor` integer;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD COLUMN `price_max_minor` integer;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD COLUMN `price_currency` text;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD COLUMN `price_basis` text;
