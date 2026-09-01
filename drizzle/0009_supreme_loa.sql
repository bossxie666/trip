CREATE TABLE `route_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`from_source` text NOT NULL,
	`from_id` text NOT NULL,
	`to_source` text NOT NULL,
	`to_id` text NOT NULL,
	`member_id` text,
	`preferred_mode` text NOT NULL,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_route_preferences_segment_member` ON `route_preferences` (`trip_id`,`day_id`,`from_source`,`from_id`,`to_source`,`to_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_route_preferences_day` ON `route_preferences` (`trip_id`,`day_id`);--> statement-breakpoint
CREATE TABLE `trip_saved_places` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`place_id` text NOT NULL,
	`created_by_member_id` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trip_saved_places_trip_place` ON `trip_saved_places` (`trip_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `idx_trip_saved_places_trip_created` ON `trip_saved_places` (`trip_id`,`created_at`);