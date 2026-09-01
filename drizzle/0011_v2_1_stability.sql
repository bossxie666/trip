-- Additive E1 planning stability primitives.
-- A missing day_member_presence row means "not set"; it is never inferred.
CREATE TABLE IF NOT EXISTS `day_member_presence` (
  `id` text PRIMARY KEY NOT NULL,
  `trip_id` text NOT NULL,
  `day_id` text NOT NULL,
  `member_id` text NOT NULL,
  `state` text NOT NULL,
  `starts_at` text,
  `ends_at` text,
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
CREATE UNIQUE INDEX IF NOT EXISTS `idx_day_member_presence_unique` ON `day_member_presence` (`day_id`,`member_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_day_member_presence_trip_day` ON `day_member_presence` (`trip_id`,`day_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `day_timeline_positions` (
  `id` text PRIMARY KEY NOT NULL,
  `trip_id` text NOT NULL,
  `day_id` text NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text NOT NULL,
  `anchor_type` text,
  `sort_order` integer NOT NULL,
  `created_by_member_id` text,
  `updated_by_member_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_day_timeline_position_source` ON `day_timeline_positions` (`day_id`,`source_type`,`source_id`,`anchor_type`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_day_timeline_position_order` ON `day_timeline_positions` (`day_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_day_timeline_position_trip_day` ON `day_timeline_positions` (`trip_id`,`day_id`);
--> statement-breakpoint
PRAGMA optimize;
