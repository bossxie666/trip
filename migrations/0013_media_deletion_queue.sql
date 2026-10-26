CREATE TABLE IF NOT EXISTS `media_deletion_queue` (
  `object_key` text PRIMARY KEY NOT NULL,
  `asset_id` text NOT NULL,
  `created_at` text NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `next_attempt_at` text NOT NULL,
  `last_error_code` text
);
CREATE INDEX IF NOT EXISTS `idx_media_deletion_due` ON `media_deletion_queue` (`next_attempt_at`, `created_at`);
