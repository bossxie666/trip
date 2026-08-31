ALTER TABLE `trip_members` ADD `presence_coverage` text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
