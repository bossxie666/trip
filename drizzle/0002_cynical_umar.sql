CREATE TABLE `day_places` (
	`day_id` text NOT NULL,
	`place_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`note` text,
	`arrival_time` text,
	`departure_time` text,
	PRIMARY KEY(`day_id`, `place_id`),
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_day_places_day_sort` ON `day_places` (`day_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_day_places_place` ON `day_places` (`place_id`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city_id` text NOT NULL,
	`address` text,
	`latitude` real,
	`longitude` real,
	`coordinate_system` text,
	`provider` text DEFAULT 'manual',
	`provider_place_id` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_places_city_name` ON `places` (`city_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_places_city_created` ON `places` (`city_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `trip_places` (
	`trip_id` text NOT NULL,
	`place_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`trip_id`, `place_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_trip_places_place` ON `trip_places` (`place_id`);
--> statement-breakpoint
INSERT INTO `cities` (`id`,`slug`,`name`,`created_at`) SELECT 'city-shadow-shanghai','shanghai','上海','2026-08-31T00:00:00.000Z' WHERE NOT EXISTS (SELECT 1 FROM `cities` WHERE `name`='上海');
--> statement-breakpoint
INSERT INTO `cities` (`id`,`slug`,`name`,`created_at`) SELECT 'city-shadow-hangzhou','hangzhou','杭州','2026-08-31T00:00:00.000Z' WHERE NOT EXISTS (SELECT 1 FROM `cities` WHERE `name`='杭州');
--> statement-breakpoint
INSERT INTO `places` (`id`,`name`,`city_id`,`provider`,`created_at`,`updated_at`) SELECT 'place-pvg-t2','上海浦东国际机场 T2',`id`,'manual','2026-08-31T00:00:00.000Z','2026-08-31T00:00:00.000Z' FROM `cities` WHERE `name`='上海';
--> statement-breakpoint
INSERT INTO `places` (`id`,`name`,`city_id`,`provider`,`created_at`,`updated_at`) SELECT 'place-shanghai-south','上海南站',`id`,'manual','2026-08-31T00:00:01.000Z','2026-08-31T00:00:01.000Z' FROM `cities` WHERE `name`='上海';
--> statement-breakpoint
INSERT INTO `places` (`id`,`name`,`city_id`,`provider`,`created_at`,`updated_at`) SELECT 'place-shanghai-disney','上海迪士尼度假区',`id`,'manual','2026-08-31T00:00:02.000Z','2026-08-31T00:00:02.000Z' FROM `cities` WHERE `name`='上海';
--> statement-breakpoint
INSERT INTO `places` (`id`,`name`,`city_id`,`provider`,`created_at`,`updated_at`) SELECT 'place-oriental-pearl','东方明珠',`id`,'manual','2026-08-31T00:00:03.000Z','2026-08-31T00:00:03.000Z' FROM `cities` WHERE `name`='上海';
--> statement-breakpoint
INSERT INTO `places` (`id`,`name`,`city_id`,`provider`,`created_at`,`updated_at`) SELECT 'place-the-bund','外滩',`id`,'manual','2026-08-31T00:00:04.000Z','2026-08-31T00:00:04.000Z' FROM `cities` WHERE `name`='上海';
--> statement-breakpoint
INSERT INTO `places` (`id`,`name`,`city_id`,`provider`,`created_at`,`updated_at`) SELECT 'place-hangzhou-east','杭州东站',`id`,'manual','2026-08-31T00:00:05.000Z','2026-08-31T00:00:05.000Z' FROM `cities` WHERE `name`='杭州';
--> statement-breakpoint
PRAGMA optimize;
