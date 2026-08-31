CREATE TABLE `booking_cost_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`cost_line_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cost_line_id`) REFERENCES `booking_cost_lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_allocations_member` ON `booking_cost_allocations` (`cost_line_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_booking_allocations_member_lookup` ON `booking_cost_allocations` (`member_id`);--> statement-breakpoint
CREATE TABLE `booking_cost_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`title` text NOT NULL,
	`service_start_date` text,
	`service_end_date` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`allocation_mode` text NOT NULL,
	`sort_order` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_cost_lines_order` ON `booking_cost_lines` (`booking_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `booking_participants` (
	`booking_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role` text DEFAULT 'covered' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`booking_id`, `member_id`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_booking_participants_member` ON `booking_participants` (`member_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`provider` text,
	`temporal_kind` text NOT NULL,
	`start_at` text,
	`end_at` text,
	`start_date_local` text,
	`end_date_local` text,
	`timezone` text,
	`place_id` text,
	`origin_place_id` text,
	`destination_place_id` text,
	`total_amount_minor` integer,
	`currency` text,
	`booking_reference` text,
	`notes` text,
	`protected` integer DEFAULT false NOT NULL,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`origin_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`destination_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_trip_status_start` ON `bookings` (`trip_id`,`status`,`start_at`);--> statement-breakpoint
CREATE INDEX `idx_bookings_trip_local_date` ON `bookings` (`trip_id`,`start_date_local`);--> statement-breakpoint
CREATE TABLE `framework_constraints` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text,
	`stage_id` text,
	`booking_id` text,
	`constraint_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`strength` text NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `trip_stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_framework_constraints_trip_day` ON `framework_constraints` (`trip_id`,`day_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `itinerary_item_participant_overrides` (
	`itinerary_item_id` text NOT NULL,
	`member_id` text NOT NULL,
	`participation` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`itinerary_item_id`, `member_id`),
	FOREIGN KEY (`itinerary_item_id`) REFERENCES `itinerary_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_itinerary_overrides_member` ON `itinerary_item_participant_overrides` (`member_id`);--> statement-breakpoint
CREATE TABLE `itinerary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`stage_id` text,
	`recommendation_id` text,
	`place_id` text,
	`origin_place_id` text,
	`destination_place_id` text,
	`item_type` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`start_time_local` text,
	`duration_minutes` integer,
	`sort_order` integer NOT NULL,
	`locked_at` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `trip_stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`origin_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`destination_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_itinerary_items_day_order` ON `itinerary_items` (`day_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_itinerary_items_trip_day` ON `itinerary_items` (`trip_id`,`day_id`);--> statement-breakpoint
CREATE INDEX `idx_itinerary_items_recommendation` ON `itinerary_items` (`recommendation_id`);--> statement-breakpoint
CREATE INDEX `idx_itinerary_items_place` ON `itinerary_items` (`place_id`);--> statement-breakpoint
CREATE TABLE `member_presence_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`member_id` text NOT NULL,
	`stage_id` text,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`timezone` text NOT NULL,
	`note` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `trip_stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_presence_trip_member_start` ON `member_presence_windows` (`trip_id`,`member_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_presence_trip_stage_start` ON `member_presence_windows` (`trip_id`,`stage_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `recommendation_member_states` (
	`recommendation_id` text NOT NULL,
	`member_id` text NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`recommendation_id`, `member_id`),
	FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rec_member_states_member` ON `recommendation_member_states` (`member_id`,`is_favorite`);--> statement-breakpoint
CREATE TABLE `recommendation_place_options` (
	`id` text PRIMARY KEY NOT NULL,
	`recommendation_id` text NOT NULL,
	`place_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`option_group_key` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rec_place_options_relation` ON `recommendation_place_options` (`recommendation_id`,`place_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `idx_rec_place_options_order` ON `recommendation_place_options` (`recommendation_id`,`relation_type`,`option_group_key`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_rec_place_options_place` ON `recommendation_place_options` (`place_id`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`area_label` text,
	`area_key` text,
	`is_core` integer DEFAULT false NOT NULL,
	`estimated_duration_minutes` integer,
	`estimated_cost_minor` integer,
	`cost_basis` text,
	`source_label` text,
	`source_url` text,
	`cover_image_url` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_recommendations_trip_category` ON `recommendations` (`trip_id`,`deleted_at`,`category`);--> statement-breakpoint
CREATE INDEX `idx_recommendations_trip_area_core` ON `recommendations` (`trip_id`,`area_key`,`is_core`);--> statement-breakpoint
CREATE INDEX `idx_recommendations_trip_created` ON `recommendations` (`trip_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `days` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `trips` ADD `timezone` text;