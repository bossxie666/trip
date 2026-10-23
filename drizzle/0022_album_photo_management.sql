ALTER TABLE `album_media` ADD `captured_at` text;--> statement-breakpoint
ALTER TABLE `album_media` ADD `is_favorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `album_media` SET `captured_at` = `created_at` WHERE `captured_at` IS NULL;--> statement-breakpoint
CREATE TABLE `album_tags` (`id` text PRIMARY KEY NOT NULL,`album_id` text NOT NULL,`name` text NOT NULL,`created_at` text NOT NULL,FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE cascade);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_album_tags_name` ON `album_tags` (`album_id`,`name`);--> statement-breakpoint
CREATE TABLE `album_media_tags` (`album_id` text NOT NULL,`media_asset_id` text NOT NULL,`tag_id` text NOT NULL,PRIMARY KEY (`album_id`,`media_asset_id`,`tag_id`),FOREIGN KEY (`tag_id`) REFERENCES `album_tags`(`id`) ON DELETE cascade);--> statement-breakpoint
CREATE INDEX `idx_album_media_tags_tag` ON `album_media_tags` (`tag_id`);
