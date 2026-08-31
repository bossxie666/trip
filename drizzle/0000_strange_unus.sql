CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cities_name` ON `cities` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cities_slug` ON `cities` (`slug`);--> statement-breakpoint
CREATE TABLE `days` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`date` text,
	`title` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_days_trip_day_number` ON `days` (`trip_id`,`day_number`);--> statement-breakpoint
CREATE TABLE `trip_cities` (
	`trip_id` text NOT NULL,
	`city_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`trip_id`, `city_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_trip_cities_trip_position` ON `trip_cities` (`trip_id`,`position`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`people` integer DEFAULT 1 NOT NULL,
	`cover` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trips_slug` ON `trips` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_trips_status_created` ON `trips` (`status`,`created_at`);