ALTER TABLE `album_media` ADD `captured_at` text;
ALTER TABLE `album_media` ADD `is_favorite` integer DEFAULT false NOT NULL;
UPDATE `album_media` SET `captured_at` = `created_at` WHERE `captured_at` IS NULL;

CREATE TABLE `album_tags` (
  `id` text PRIMARY KEY NOT NULL,
  `album_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_album_tags_name` ON `album_tags` (`album_id`,`name`);

CREATE TABLE `album_media_tags` (
  `album_id` text NOT NULL,
  `media_asset_id` text NOT NULL,
  `tag_id` text NOT NULL,
  PRIMARY KEY (`album_id`,`media_asset_id`,`tag_id`),
  FOREIGN KEY (`tag_id`) REFERENCES `album_tags`(`id`) ON DELETE cascade
);
CREATE INDEX `idx_album_media_tags_tag` ON `album_media_tags` (`tag_id`);
