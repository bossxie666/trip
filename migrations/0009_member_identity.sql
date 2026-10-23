ALTER TABLE `members` ADD `role` text DEFAULT 'member' NOT NULL CHECK (`role` IN ('admin','member'));
ALTER TABLE `members` ADD `credential_status` text DEFAULT 'legacy' NOT NULL CHECK (`credential_status` IN ('legacy','active','disabled'));
ALTER TABLE `members` ADD `last_login_at` text;
UPDATE `members` SET `role` = 'admin' WHERE `id` = 'member-nini';
CREATE TABLE `member_credentials` (
  `member_id` text PRIMARY KEY NOT NULL,
  `algorithm` text NOT NULL,
  `algorithm_version` integer NOT NULL,
  `salt` text NOT NULL,
  `password_digest` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE cascade
);
CREATE TABLE `member_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `token_digest` text NOT NULL,
  `member_id` text NOT NULL,
  `device_summary` text,
  `created_at` text NOT NULL,
  `last_used_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `revoked_at` text,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_member_sessions_token` ON `member_sessions` (`token_digest`);
CREATE INDEX `idx_member_sessions_member_active` ON `member_sessions` (`member_id`,`revoked_at`,`expires_at`);
CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text,
  `request_id` text NOT NULL,
  `metadata_json` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE set null
);
CREATE INDEX `idx_audit_events_created` ON `audit_events` (`created_at`);
CREATE INDEX `idx_audit_events_resource` ON `audit_events` (`resource_type`,`resource_id`,`created_at`);
