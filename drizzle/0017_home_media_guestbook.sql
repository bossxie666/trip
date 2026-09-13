CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`uploader_member_id` text NOT NULL,
	`purpose` text NOT NULL,
	`object_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`ready_at` text,
	FOREIGN KEY (`uploader_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_assets_object_key` ON `media_assets` (`object_key`);
--> statement-breakpoint
CREATE INDEX `idx_media_assets_owner_purpose` ON `media_assets` (`uploader_member_id`,`purpose`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_media_assets_status_created` ON `media_assets` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `home_featured_photos` (
	`slot_key` text PRIMARY KEY NOT NULL,
	`media_asset_id` text NOT NULL,
	`updated_by_member_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_home_featured_media` ON `home_featured_photos` (`media_asset_id`);
--> statement-breakpoint
CREATE TABLE `guestbook_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`author_member_id` text NOT NULL,
	`body` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`author_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_guestbook_messages_visible` ON `guestbook_messages` (`deleted_at`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_guestbook_messages_author` ON `guestbook_messages` (`author_member_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `guestbook_message_media` (
	`message_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`message_id`, `media_asset_id`),
	FOREIGN KEY (`message_id`) REFERENCES `guestbook_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_guestbook_message_media_order` ON `guestbook_message_media` (`message_id`,`sort_order`);
