CREATE TABLE IF NOT EXISTS `trip_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`city_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_trip_stages_trip_order` ON `trip_stages` (`trip_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_trip_stages_trip` ON `trip_stages` (`trip_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trip_stage_members` (
	`stage_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`stage_id`, `member_id`),
	FOREIGN KEY (`stage_id`) REFERENCES `trip_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_trip_stage_members_member` ON `trip_stage_members` (`member_id`);--> statement-breakpoint
ALTER TABLE `trip_places` ADD `plan_status` text DEFAULT 'candidate' NOT NULL;
--> statement-breakpoint
-- These six D1 seed places already have coordinates in data/places.ts. Copy them
-- into the database only when the existing row is still empty; keep provider
-- manual until a member selects a verified AMap POI for the place.
UPDATE `places` SET `latitude`=31.1443,`longitude`=121.8083,`coordinate_system`='GCJ02',`updated_at`='2026-08-31T00:00:00.000Z' WHERE `id`='place-pvg-t2' AND `latitude` IS NULL AND `longitude` IS NULL;
UPDATE `places` SET `latitude`=31.154,`longitude`=121.429,`coordinate_system`='GCJ02',`updated_at`='2026-08-31T00:00:01.000Z' WHERE `id`='place-shanghai-south' AND `latitude` IS NULL AND `longitude` IS NULL;
UPDATE `places` SET `latitude`=31.1433,`longitude`=121.6578,`coordinate_system`='GCJ02',`updated_at`='2026-08-31T00:00:02.000Z' WHERE `id`='place-shanghai-disney' AND `latitude` IS NULL AND `longitude` IS NULL;
UPDATE `places` SET `latitude`=31.2397,`longitude`=121.4998,`coordinate_system`='GCJ02',`updated_at`='2026-08-31T00:00:03.000Z' WHERE `id`='place-oriental-pearl' AND `latitude` IS NULL AND `longitude` IS NULL;
UPDATE `places` SET `latitude`=31.24,`longitude`=121.49,`coordinate_system`='GCJ02',`updated_at`='2026-08-31T00:00:04.000Z' WHERE `id`='place-the-bund' AND `latitude` IS NULL AND `longitude` IS NULL;
UPDATE `places` SET `latitude`=30.291,`longitude`=120.212,`coordinate_system`='GCJ02',`updated_at`='2026-08-31T00:00:05.000Z' WHERE `id`='place-hangzhou-east' AND `latitude` IS NULL AND `longitude` IS NULL;
--> statement-breakpoint
INSERT INTO `trips` (`id`,`slug`,`title`,`status`,`start_date`,`end_date`,`people`,`cover`,`created_at`,`updated_at`,`protected`,`created_by_member_id`,`updated_by_member_id`)
SELECT 'trip-shanghai-hangzhou-2026','shanghai-hangzhou-2026','上海 + 杭州','planning','2026-09-23','2026-09-24',4,'/og.png','2026-08-30T00:00:00.000Z','2026-08-30T00:00:00.000Z',1,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM `trips` WHERE `slug`='shanghai-hangzhou-2026');
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_cities` (`trip_id`,`city_id`,`position`)
SELECT `trips`.`id`,`cities`.`id`,0 FROM `trips`,`cities` WHERE `trips`.`slug`='shanghai-hangzhou-2026' AND `cities`.`name`='上海';
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_cities` (`trip_id`,`city_id`,`position`)
SELECT `trips`.`id`,`cities`.`id`,1 FROM `trips`,`cities` WHERE `trips`.`slug`='shanghai-hangzhou-2026' AND `cities`.`name`='杭州';
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_members` (`trip_id`,`member_id`)
SELECT `trips`.`id`,`members`.`id` FROM `trips`,`members` WHERE `trips`.`slug`='shanghai-hangzhou-2026' AND `members`.`active`=1 AND `members`.`id` IN ('member-nini','member-zhu-jingqi','member-wang-jingwen','member-liu-xu','member-sun-yan');
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_stages` (`id`,`trip_id`,`city_id`,`title`,`sort_order`,`created_at`,`updated_at`)
SELECT 'trip-shanghai-hangzhou-2026-stage-shanghai',`trips`.`id`,`cities`.`id`,'上海阶段',1,'2026-08-31T00:00:00.000Z','2026-08-31T00:00:00.000Z'
FROM `trips`,`cities` WHERE `trips`.`slug`='shanghai-hangzhou-2026' AND `cities`.`name`='上海';
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_stages` (`id`,`trip_id`,`city_id`,`title`,`sort_order`,`created_at`,`updated_at`)
SELECT 'trip-shanghai-hangzhou-2026-stage-hangzhou',`trips`.`id`,`cities`.`id`,'杭州阶段',2,'2026-08-31T00:00:00.000Z','2026-08-31T00:00:00.000Z'
FROM `trips`,`cities` WHERE `trips`.`slug`='shanghai-hangzhou-2026' AND `cities`.`name`='杭州';
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_stage_members` (`stage_id`,`member_id`) VALUES
('trip-shanghai-hangzhou-2026-stage-shanghai','member-nini'),
('trip-shanghai-hangzhou-2026-stage-shanghai','member-wang-jingwen'),
('trip-shanghai-hangzhou-2026-stage-shanghai','member-liu-xu'),
('trip-shanghai-hangzhou-2026-stage-shanghai','member-sun-yan'),
('trip-shanghai-hangzhou-2026-stage-hangzhou','member-nini'),
('trip-shanghai-hangzhou-2026-stage-hangzhou','member-zhu-jingqi'),
('trip-shanghai-hangzhou-2026-stage-hangzhou','member-wang-jingwen'),
('trip-shanghai-hangzhou-2026-stage-hangzhou','member-liu-xu'),
('trip-shanghai-hangzhou-2026-stage-hangzhou','member-sun-yan');
--> statement-breakpoint
INSERT OR IGNORE INTO `days` (`id`,`trip_id`,`day_number`,`date`,`title`)
SELECT 'trip-shanghai-hangzhou-2026-day-1',`trips`.`id`,1,'2026-09-23','浦东落地 · 上海迪士尼' FROM `trips` WHERE `trips`.`slug`='shanghai-hangzhou-2026';
--> statement-breakpoint
INSERT OR IGNORE INTO `days` (`id`,`trip_id`,`day_number`,`date`,`title`)
SELECT 'trip-shanghai-hangzhou-2026-day-2',`trips`.`id`,2,'2026-09-24','陆家嘴 · 外滩 · 前往杭州' FROM `trips` WHERE `trips`.`slug`='shanghai-hangzhou-2026';
--> statement-breakpoint
INSERT OR IGNORE INTO `trip_places` (`trip_id`,`place_id`,`plan_status`,`created_at`)
SELECT `trips`.`id`,`places`.`id`,'candidate',`places`.`created_at`
FROM `trips`,`places` WHERE `trips`.`slug`='shanghai-hangzhou-2026' AND `places`.`id` IN ('place-pvg-t2','place-shanghai-disney','place-oriental-pearl','place-the-bund','place-shanghai-south','place-hangzhou-east');
--> statement-breakpoint
INSERT OR IGNORE INTO `day_places` (`day_id`,`place_id`,`sort_order`)
SELECT `days`.`id`,`places`.`id`,CASE `places`.`id`
  WHEN 'place-pvg-t2' THEN 1
  WHEN 'place-shanghai-disney' THEN 2
  WHEN 'place-oriental-pearl' THEN 1
  WHEN 'place-the-bund' THEN 2
  WHEN 'place-shanghai-south' THEN 3
  WHEN 'place-hangzhou-east' THEN 4
END
FROM `days`,`trips`,`places`
WHERE `days`.`trip_id`=`trips`.`id` AND `trips`.`slug`='shanghai-hangzhou-2026'
  AND ((`days`.`day_number`=1 AND `places`.`id` IN ('place-pvg-t2','place-shanghai-disney'))
    OR (`days`.`day_number`=2 AND `places`.`id` IN ('place-oriental-pearl','place-the-bund','place-shanghai-south','place-hangzhou-east')));
--> statement-breakpoint
PRAGMA optimize;
