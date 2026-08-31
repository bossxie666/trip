DROP INDEX `idx_places_city_name`;--> statement-breakpoint
ALTER TABLE `places` ADD `adcode` text;--> statement-breakpoint
ALTER TABLE `places` ADD `city_code` text;--> statement-breakpoint
ALTER TABLE `places` ADD `district` text;--> statement-breakpoint
ALTER TABLE `places` ADD `type_code` text;--> statement-breakpoint
ALTER TABLE `places` ADD `provider_updated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_places_provider_id` ON `places` (`provider`,`provider_place_id`);--> statement-breakpoint
CREATE INDEX `idx_places_city_name` ON `places` (`city_id`,`name`);