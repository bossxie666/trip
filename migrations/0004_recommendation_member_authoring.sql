ALTER TABLE `recommendation_references` ADD COLUMN `created_by_member_id` text REFERENCES `members`(`id`) ON DELETE set null;
ALTER TABLE `recommendation_references` ADD COLUMN `updated_by_member_id` text REFERENCES `members`(`id`) ON DELETE set null;
CREATE TABLE `recommendation_reference_media` (
  `reference_id` text NOT NULL,
  `media_asset_id` text NOT NULL,
  `sort_order` integer NOT NULL,
  PRIMARY KEY(`reference_id`, `media_asset_id`),
  FOREIGN KEY (`reference_id`) REFERENCES `recommendation_references`(`id`) ON DELETE cascade,
  FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict
);
CREATE UNIQUE INDEX `idx_recommendation_reference_media_order` ON `recommendation_reference_media` (`reference_id`,`sort_order`);
