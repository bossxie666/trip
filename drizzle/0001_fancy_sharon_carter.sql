CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_name` ON `members` (`name`);--> statement-breakpoint
CREATE TABLE `trip_members` (
	`trip_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`trip_id`, `member_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_trip_members_member` ON `trip_members` (`member_id`);--> statement-breakpoint
ALTER TABLE `trips` ADD `protected` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trips` ADD `created_by_member_id` text REFERENCES members(id);--> statement-breakpoint
ALTER TABLE `trips` ADD `updated_by_member_id` text REFERENCES members(id);
--> statement-breakpoint
INSERT INTO `members` (`id`,`name`,`display_name`,`avatar`,`active`,`created_at`) VALUES
('member-nini','nini','nini',NULL,1,'2026-08-31T00:00:00.000Z'),
('member-zhu-jingqi','zhu-jingqi','朱婧琪',NULL,1,'2026-08-31T00:00:01.000Z'),
('member-wang-jingwen','wang-jingwen','王静雯',NULL,1,'2026-08-31T00:00:02.000Z'),
('member-liu-xu','liu-xu','刘徐',NULL,1,'2026-08-31T00:00:03.000Z'),
('member-sun-yan','sun-yan','孙艳',NULL,1,'2026-08-31T00:00:04.000Z');
--> statement-breakpoint
PRAGMA optimize;
