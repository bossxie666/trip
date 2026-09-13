ALTER TABLE `recommendations` ADD COLUMN `guide_type` text;
--> statement-breakpoint
CREATE TABLE `recommendation_references` (
  `id` text PRIMARY KEY NOT NULL,
  `recommendation_id` text NOT NULL,
  `platform` text NOT NULL,
  `author_label` text,
  `title` text,
  `source_url` text NOT NULL,
  `image_urls_json` text,
  `note` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recommendation_references_order` ON `recommendation_references` (`recommendation_id`,`sort_order`);
