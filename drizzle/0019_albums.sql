CREATE TABLE `albums` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `trip_id` text,
  `created_by_member_id` text NOT NULL,
  `cover_media_asset_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`cover_media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_albums_visible_updated` ON `albums` (`deleted_at`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_albums_trip_updated` ON `albums` (`trip_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `album_media` (
  `album_id` text NOT NULL,
  `media_asset_id` text NOT NULL,
  `uploaded_by_member_id` text NOT NULL,
  `sort_order` integer NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`album_id`, `media_asset_id`),
  FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`uploaded_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_album_media_order` ON `album_media` (`album_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_album_media_asset` ON `album_media` (`media_asset_id`);
