-- Production 25 baseline for self-owned Cloudflare D1.
-- Source: OpenAI Sites production D1, binding DB.
-- Source version: 25; source commit: ef9c90ee2de71da7e59e2e47e6a325df6f496324.
-- This baseline intentionally does not replay historical drizzle migrations.
-- Stable production IDs and current rows are copied exactly; no test fixture is included.
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

CREATE UNIQUE INDEX `idx_booking_allocations_member` ON `booking_cost_allocations` (`cost_line_id`,`member_id`);
CREATE INDEX `idx_booking_allocations_member_lookup` ON `booking_cost_allocations` (`member_id`);
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

CREATE UNIQUE INDEX `idx_booking_cost_lines_order` ON `booking_cost_lines` (`booking_id`,`sort_order`);
CREATE TABLE `booking_participants` (
	`booking_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role` text DEFAULT 'covered' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`booking_id`, `member_id`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `idx_booking_participants_member` ON `booking_participants` (`member_id`);
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

CREATE INDEX `idx_bookings_trip_status_start` ON `bookings` (`trip_id`,`status`,`start_at`);
CREATE INDEX `idx_bookings_trip_local_date` ON `bookings` (`trip_id`,`start_date_local`);
CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);

CREATE UNIQUE INDEX `idx_cities_name` ON `cities` (`name`);
CREATE UNIQUE INDEX `idx_cities_slug` ON `cities` (`slug`);
CREATE TABLE `day_places` (
	`day_id` text NOT NULL,
	`place_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`note` text,
	`arrival_time` text,
	`departure_time` text,
	PRIMARY KEY(`day_id`, `place_id`),
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `idx_day_places_day_sort` ON `day_places` (`day_id`,`sort_order`);
CREATE INDEX `idx_day_places_place` ON `day_places` (`place_id`);
CREATE TABLE `day_member_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`member_id` text NOT NULL,
	`state` text NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `idx_day_member_presence_unique` ON `day_member_presence` (`day_id`,`member_id`);
CREATE INDEX `idx_day_member_presence_trip_day` ON `day_member_presence` (`trip_id`,`day_id`);
CREATE TABLE `days` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`date` text,
	`title` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `idx_days_trip_day_number` ON `days` (`trip_id`,`day_number`);
CREATE TABLE `day_timeline_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`anchor_type` text,
	`sort_order` integer NOT NULL,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `idx_day_timeline_position_source` ON `day_timeline_positions` (`day_id`,`source_type`,`source_id`,`anchor_type`);
CREATE UNIQUE INDEX `idx_day_timeline_position_order` ON `day_timeline_positions` (`day_id`,`sort_order`);
CREATE INDEX `idx_day_timeline_position_trip_day` ON `day_timeline_positions` (`trip_id`,`day_id`);
CREATE TABLE `expense_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `idx_expense_allocations_expense_member` ON `expense_allocations` (`expense_id`,`member_id`);
CREATE INDEX `idx_expense_allocations_member` ON `expense_allocations` (`member_id`);
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`scope` text NOT NULL,
	`paid_by_member_id` text,
	`created_by_member_id` text NOT NULL,
	`notes` text,
	`occurred_at` text,
	`occurred_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`paid_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `idx_expenses_trip_date` ON `expenses` (`trip_id`,`occurred_date`,`created_at`);
CREATE INDEX `idx_expenses_trip_creator` ON `expenses` (`trip_id`,`created_by_member_id`,`deleted_at`);
CREATE INDEX `idx_expenses_day` ON `expenses` (`day_id`);
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

CREATE INDEX `idx_framework_constraints_trip_day` ON `framework_constraints` (`trip_id`,`day_id`,`deleted_at`);
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

CREATE INDEX `idx_itinerary_overrides_member` ON `itinerary_item_participant_overrides` (`member_id`);
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
	`end_time_local` text,
	`time_mode` text DEFAULT 'untimed' NOT NULL,
	`opening_hours_note` text,
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

CREATE UNIQUE INDEX `idx_itinerary_items_day_order` ON `itinerary_items` (`day_id`,`sort_order`);
CREATE INDEX `idx_itinerary_items_trip_day` ON `itinerary_items` (`trip_id`,`day_id`);
CREATE INDEX `idx_itinerary_items_recommendation` ON `itinerary_items` (`recommendation_id`);
CREATE INDEX `idx_itinerary_items_place` ON `itinerary_items` (`place_id`);
CREATE TABLE `member_budget_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`member_id` text NOT NULL,
	`category` text NOT NULL,
	`planned_amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `idx_member_budget_plans_trip_member_category` ON `member_budget_plans` (`trip_id`,`member_id`,`category`);
CREATE INDEX `idx_member_budget_plans_trip_member` ON `member_budget_plans` (`trip_id`,`member_id`);
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

CREATE INDEX `idx_presence_trip_member_start` ON `member_presence_windows` (`trip_id`,`member_id`,`starts_at`);
CREATE INDEX `idx_presence_trip_stage_start` ON `member_presence_windows` (`trip_id`,`stage_id`,`starts_at`);
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);

CREATE UNIQUE INDEX `idx_members_name` ON `members` (`name`);
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city_id` text NOT NULL,
	`address` text,
	`latitude` real,
	`longitude` real,
	`coordinate_system` text,
	`provider` text DEFAULT 'manual',
	`provider_place_id` text,
	`adcode` text,
	`city_code` text,
	`district` text,
	`type_code` text,
	`provider_updated_at` text,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `idx_places_city_name` ON `places` (`city_id`,`name`);
CREATE INDEX `idx_places_city_created` ON `places` (`city_id`,`created_at`);
CREATE UNIQUE INDEX `idx_places_provider_id` ON `places` (`provider`,`provider_place_id`);
CREATE TABLE `recommendation_member_states` (
	`recommendation_id` text NOT NULL,
	`member_id` text NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`recommendation_id`, `member_id`),
	FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_rec_member_states_member` ON `recommendation_member_states` (`member_id`,`is_favorite`);
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

CREATE UNIQUE INDEX `idx_rec_place_options_relation` ON `recommendation_place_options` (`recommendation_id`,`place_id`,`relation_type`);
CREATE INDEX `idx_rec_place_options_order` ON `recommendation_place_options` (`recommendation_id`,`relation_type`,`option_group_key`,`sort_order`);
CREATE INDEX `idx_rec_place_options_place` ON `recommendation_place_options` (`place_id`);
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
	`price_min_minor` integer,
	`price_max_minor` integer,
	`price_currency` text,
	`price_basis` text,
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

CREATE INDEX `idx_recommendations_trip_category` ON `recommendations` (`trip_id`,`deleted_at`,`category`);
CREATE INDEX `idx_recommendations_trip_area_core` ON `recommendations` (`trip_id`,`area_key`,`is_core`);
CREATE INDEX `idx_recommendations_trip_created` ON `recommendations` (`trip_id`,`created_at`);
CREATE TABLE `route_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_id` text NOT NULL,
	`from_source` text NOT NULL,
	`from_id` text NOT NULL,
	`to_source` text NOT NULL,
	`to_id` text NOT NULL,
	`member_id` text,
	`preferred_mode` text NOT NULL,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `idx_route_preferences_segment_member` ON `route_preferences` (`trip_id`,`day_id`,`from_source`,`from_id`,`to_source`,`to_id`,`member_id`);
CREATE INDEX `idx_route_preferences_day` ON `route_preferences` (`trip_id`,`day_id`);
CREATE TABLE `trip_cities` (
	`trip_id` text NOT NULL,
	`city_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`trip_id`, `city_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_trip_cities_trip_position` ON `trip_cities` (`trip_id`,`position`);
CREATE TABLE `trip_members` (
	`trip_id` text NOT NULL,
	`member_id` text NOT NULL,
	`presence_coverage` text DEFAULT 'unknown' NOT NULL,
	PRIMARY KEY(`trip_id`, `member_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_trip_members_member` ON `trip_members` (`member_id`);
CREATE TABLE `trip_places` (
	`trip_id` text NOT NULL,
	`place_id` text NOT NULL,
	`plan_status` text DEFAULT 'candidate' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`trip_id`, `place_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `idx_trip_places_place` ON `trip_places` (`place_id`);
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`people` integer DEFAULT 1 NOT NULL,
	`cover` text,
	`timezone` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`protected` integer DEFAULT false NOT NULL,
	`created_by_member_id` text,
	`updated_by_member_id` text,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `idx_trips_slug` ON `trips` (`slug`);
CREATE INDEX `idx_trips_status_created` ON `trips` (`status`,`created_at`);
CREATE TABLE `trip_saved_places` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`place_id` text NOT NULL,
	`created_by_member_id` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `idx_trip_saved_places_trip_place` ON `trip_saved_places` (`trip_id`,`place_id`);
CREATE INDEX `idx_trip_saved_places_trip_created` ON `trip_saved_places` (`trip_id`,`created_at`);
CREATE TABLE `trip_stage_members` (
	`stage_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`stage_id`, `member_id`),
	FOREIGN KEY (`stage_id`) REFERENCES `trip_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_trip_stage_members_member` ON `trip_stage_members` (`member_id`);
CREATE TABLE `trip_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`city_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `idx_trip_stages_trip_order` ON `trip_stages` (`trip_id`,`sort_order`);
CREATE INDEX `idx_trip_stages_trip` ON `trip_stages` (`trip_id`);
INSERT INTO "members" ("id", "name", "display_name", "avatar", "active", "created_at") VALUES ('member-liu-xu', 'liu-xu', '刘徐', NULL, 1, '2026-08-31T00:00:03.000Z');
INSERT INTO "members" ("id", "name", "display_name", "avatar", "active", "created_at") VALUES ('member-nini', 'nini', 'nini', NULL, 1, '2026-08-31T00:00:00.000Z');
INSERT INTO "members" ("id", "name", "display_name", "avatar", "active", "created_at") VALUES ('member-sun-yan', 'sun-yan', '孙艳', NULL, 1, '2026-08-31T00:00:04.000Z');
INSERT INTO "members" ("id", "name", "display_name", "avatar", "active", "created_at") VALUES ('member-wang-jingwen', 'wang-jingwen', '王静雯', NULL, 1, '2026-08-31T00:00:02.000Z');
INSERT INTO "members" ("id", "name", "display_name", "avatar", "active", "created_at") VALUES ('member-zhu-jingqi', 'kiki', 'kiki', NULL, 1, '2026-08-31T00:00:01.000Z');
INSERT INTO "cities" ("id", "slug", "name", "created_at") VALUES ('10a6289f-c0f0-4560-8814-90908b15f232', 'city-10a6289f', '黑龙江', '2026-08-31T10:41:55.804Z');
INSERT INTO "cities" ("id", "slug", "name", "created_at") VALUES ('72ec719b-4da0-4d0f-881d-3adea7268b92', 'city-72ec719b', '长沙', '2026-08-31T10:47:43.625Z');
INSERT INTO "cities" ("id", "slug", "name", "created_at") VALUES ('city-shadow-hangzhou', 'hangzhou', '杭州', '2026-08-31T00:00:00.000Z');
INSERT INTO "cities" ("id", "slug", "name", "created_at") VALUES ('city-shadow-shanghai', 'shanghai', '上海', '2026-08-31T00:00:00.000Z');
INSERT INTO "trips" ("id", "slug", "title", "status", "start_date", "end_date", "people", "cover", "created_at", "updated_at", "protected", "created_by_member_id", "updated_by_member_id", "timezone") VALUES ('trip-shanghai-hangzhou-2026', 'shanghai-hangzhou-2026', '上海 + 杭州', 'planning', '2026-09-23', '2026-09-27', 4, '/og.png', '2026-08-30T00:00:00.000Z', '2026-09-01T00:00:00.000Z', 1, NULL, NULL, 'Asia/Shanghai');
INSERT INTO "trip_cities" ("trip_id", "city_id", "position") VALUES ('trip-shanghai-hangzhou-2026', 'city-shadow-hangzhou', 1);
INSERT INTO "trip_cities" ("trip_id", "city_id", "position") VALUES ('trip-shanghai-hangzhou-2026', 'city-shadow-shanghai', 0);
INSERT INTO "days" ("id", "trip_id", "day_number", "date", "title", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-day-1', 'trip-shanghai-hangzhou-2026', 1, '2026-09-23', '浦东落地 · 上海迪士尼', NULL);
INSERT INTO "days" ("id", "trip_id", "day_number", "date", "title", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026', 2, '2026-09-24', '陆家嘴 · 外滩 · 前往杭州', NULL);
INSERT INTO "days" ("id", "trip_id", "day_number", "date", "title", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026', 3, '2026-09-25', '杭州 Day 1 · 灵隐寺 · 财神庙 · 西湖', '2026-09-01T00:00:00.000Z');
INSERT INTO "days" ("id", "trip_id", "day_number", "date", "title", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-day-4', 'trip-shanghai-hangzhou-2026', 4, '2026-09-26', '杭州 Day 2 · 桐庐往返', '2026-09-01T00:00:00.000Z');
INSERT INTO "days" ("id", "trip_id", "day_number", "date", "title", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-day-5', 'trip-shanghai-hangzhou-2026', 5, '2026-09-27', '杭州 Day 3 · 待定', '2026-09-01T00:00:00.000Z');
INSERT INTO "trip_members" ("trip_id", "member_id", "presence_coverage") VALUES ('trip-shanghai-hangzhou-2026', 'member-liu-xu', 'unknown');
INSERT INTO "trip_members" ("trip_id", "member_id", "presence_coverage") VALUES ('trip-shanghai-hangzhou-2026', 'member-nini', 'unknown');
INSERT INTO "trip_members" ("trip_id", "member_id", "presence_coverage") VALUES ('trip-shanghai-hangzhou-2026', 'member-sun-yan', 'unknown');
INSERT INTO "trip_members" ("trip_id", "member_id", "presence_coverage") VALUES ('trip-shanghai-hangzhou-2026', 'member-wang-jingwen', 'unknown');
INSERT INTO "trip_members" ("trip_id", "member_id", "presence_coverage") VALUES ('trip-shanghai-hangzhou-2026', 'member-zhu-jingqi', 'unknown');
INSERT INTO "trip_stages" ("id", "trip_id", "city_id", "title", "sort_order", "created_at", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-stage-hangzhou', 'trip-shanghai-hangzhou-2026', 'city-shadow-hangzhou', '杭州阶段', 2, '2026-08-31T00:00:00.000Z', '2026-08-31T00:00:00.000Z');
INSERT INTO "trip_stages" ("id", "trip_id", "city_id", "title", "sort_order", "created_at", "updated_at") VALUES ('trip-shanghai-hangzhou-2026-stage-shanghai', 'trip-shanghai-hangzhou-2026', 'city-shadow-shanghai', '上海阶段', 1, '2026-08-31T00:00:00.000Z', '2026-08-31T00:00:00.000Z');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-hangzhou', 'member-liu-xu');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-hangzhou', 'member-nini');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-hangzhou', 'member-sun-yan');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-hangzhou', 'member-wang-jingwen');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-hangzhou', 'member-zhu-jingqi');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-shanghai', 'member-liu-xu');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-shanghai', 'member-nini');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-shanghai', 'member-sun-yan');
INSERT INTO "trip_stage_members" ("stage_id", "member_id") VALUES ('trip-shanghai-hangzhou-2026-stage-shanghai', 'member-wang-jingwen');
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('0d0a9886-a13b-4910-81af-43ca152d88f0', '宿适轻奢酒店(虹梅南路店)', 'city-shadow-shanghai', '虹梅南路1005号华光生活广场F1', 31.123743, 121.423033, 'GCJ02', 'amap', 'B0FFIV8EMI', 'member-nini', 'member-nini', '2026-09-01T08:02:39.446Z', '2026-09-01T08:02:39.446Z', '310112', '021', '闵行区', '100100', '2026-09-01T08:02:39.446Z');
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('24109ed8-7e8e-49c1-8a33-80b21720c110', '宿适轻奢酒店（上海南站店）', 'city-shadow-shanghai', NULL, 31.137861, 121.413312, 'GCJ02', 'manual', NULL, 'member-nini', 'member-nini', '2026-09-01T08:04:48.799Z', '2026-09-01T08:04:48.799Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('b70b87db-ee58-42c6-bb4a-9d60df13be6f', '长沙南站', '72ec719b-4da0-4d0f-881d-3adea7268b92', '花侯路', 28.147093, 113.06551, 'GCJ02', 'amap', 'B02DB07MDA', 'member-nini', 'member-nini', '2026-08-31T10:48:44.755Z', '2026-08-31T10:48:44.755Z', '430111', '0731', '雨花区', '150200', '2026-08-31T10:48:44.755Z');
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('f4a4a2d7-3689-4562-a4b9-6ab3f3fdbe92', '万家丽国际购物广场', '72ec719b-4da0-4d0f-881d-3adea7268b92', '万家丽中路99号(万家丽广场地铁站2号线2号口步行50米)', 28.189771, 113.032322, 'GCJ02', 'amap', 'B0FFJQ3LYQ', 'member-nini', 'member-nini', '2026-08-31T10:50:03.377Z', '2026-08-31T10:50:03.377Z', '430102', '0731', '芙蓉区', '060101', '2026-08-31T10:50:03.377Z');
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('place-hangzhou-east', '杭州东站', 'city-shadow-hangzhou', NULL, 30.291, 120.212, 'GCJ02', 'manual', NULL, NULL, NULL, '2026-08-31T00:00:05.000Z', '2026-08-31T00:00:05.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('place-oriental-pearl', '东方明珠', 'city-shadow-shanghai', NULL, 31.2397, 121.4998, 'GCJ02', 'manual', NULL, NULL, NULL, '2026-08-31T00:00:03.000Z', '2026-08-31T00:00:03.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('place-pvg-t2', '上海浦东国际机场 T2', 'city-shadow-shanghai', NULL, 31.1443, 121.8083, 'GCJ02', 'manual', NULL, NULL, NULL, '2026-08-31T00:00:00.000Z', '2026-08-31T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('place-shanghai-disney', '上海迪士尼度假区', 'city-shadow-shanghai', NULL, 31.1433, 121.6578, 'GCJ02', 'manual', NULL, NULL, NULL, '2026-08-31T00:00:02.000Z', '2026-08-31T00:00:02.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('place-shanghai-south', '上海南站', 'city-shadow-shanghai', NULL, 31.154, 121.429, 'GCJ02', 'manual', NULL, NULL, NULL, '2026-08-31T00:00:01.000Z', '2026-08-31T00:00:01.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "places" ("id", "name", "city_id", "address", "latitude", "longitude", "coordinate_system", "provider", "provider_place_id", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "adcode", "city_code", "district", "type_code", "provider_updated_at") VALUES ('place-the-bund', '外滩', 'city-shadow-shanghai', NULL, 31.24, 121.49, 'GCJ02', 'manual', NULL, NULL, NULL, '2026-08-31T00:00:04.000Z', '2026-08-31T00:00:04.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-caishen-temple', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '财神庙', NULL, '杭州', 'hangzhou', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-lingyin-temple', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '灵隐寺', NULL, '杭州', 'hangzhou', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-oriental-pearl', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '东方明珠', NULL, '上海', 'shanghai', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-shanghai-disney', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '上海迪士尼', NULL, '上海', 'shanghai', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-the-bund', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '外滩', NULL, '上海', 'shanghai', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-tonglu-day-guide', 'trip-shanghai-hangzhou-2026', 'guide', 'attraction', '桐庐一日攻略', NULL, '桐庐', 'tonglu', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-west-lake', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '西湖', NULL, '杭州', 'hangzhou', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendations" ("id", "trip_id", "kind", "category", "title", "summary", "area_label", "area_key", "is_core", "estimated_duration_minutes", "estimated_cost_minor", "cost_basis", "source_label", "source_url", "cover_image_url", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at", "price_min_minor", "price_max_minor", "price_currency", "price_basis") VALUES ('recommendation-wukang-building', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '武康大楼', NULL, '上海', 'shanghai', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, NULL, NULL, NULL, NULL);
INSERT INTO "recommendation_place_options" ("id", "recommendation_id", "place_id", "relation_type", "option_group_key", "is_primary", "sort_order", "note", "created_at", "updated_at") VALUES ('rec-option-oriental-pearl-existing-place', 'recommendation-oriental-pearl', 'place-oriental-pearl', 'alternative', 'poi', 1, 1, '复用现有明确匹配地点', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "recommendation_place_options" ("id", "recommendation_id", "place_id", "relation_type", "option_group_key", "is_primary", "sort_order", "note", "created_at", "updated_at") VALUES ('rec-option-shanghai-disney-existing-place', 'recommendation-shanghai-disney', 'place-shanghai-disney', 'alternative', 'poi', 1, 1, '复用现有明确匹配地点', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "recommendation_place_options" ("id", "recommendation_id", "place_id", "relation_type", "option_group_key", "is_primary", "sort_order", "note", "created_at", "updated_at") VALUES ('rec-option-the-bund-existing-place', 'recommendation-the-bund', 'place-the-bund', 'alternative', 'poi', 1, 1, '复用现有明确匹配地点', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "bookings" ("id", "trip_id", "type", "status", "title", "provider", "temporal_kind", "start_at", "end_at", "start_date_local", "end_date_local", "timezone", "place_id", "origin_place_id", "destination_place_id", "total_amount_minor", "currency", "booking_reference", "notes", "protected", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at") VALUES ('booking-shanghai-hangzhou-flight-szx-sha-20260923', 'trip-shanghai-hangzhou-2026', 'flight', 'confirmed', '深圳 → 上海航班', '金鹏航空', 'interval', '2026-09-22T22:35:00.000Z', '2026-09-23T00:55:00.000Z', '2026-09-23', '2026-09-23', 'Asia/Shanghai', NULL, NULL, NULL, 48000, 'CNY', '航班号：Y87578', '航班号：Y87578', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z', NULL);
INSERT INTO "bookings" ("id", "trip_id", "type", "status", "title", "provider", "temporal_kind", "start_at", "end_at", "start_date_local", "end_date_local", "timezone", "place_id", "origin_place_id", "destination_place_id", "total_amount_minor", "currency", "booking_reference", "notes", "protected", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at") VALUES ('booking-shanghai-hangzhou-hotel-hangzhou-20260924', 'trip-shanghai-hangzhou-2026', 'hotel', 'confirmed', '杭州东附近酒店', NULL, 'date_range', NULL, NULL, '2026-09-24', '2026-09-27', 'Asia/Shanghai', NULL, NULL, NULL, 75280, 'CNY', NULL, '已确认；具体酒店 POI 暂未绑定', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL);
INSERT INTO "bookings" ("id", "trip_id", "type", "status", "title", "provider", "temporal_kind", "start_at", "end_at", "start_date_local", "end_date_local", "timezone", "place_id", "origin_place_id", "destination_place_id", "total_amount_minor", "currency", "booking_reference", "notes", "protected", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "deleted_at") VALUES ('booking-shanghai-hangzhou-hotel-shanghai-20260923', 'trip-shanghai-hangzhou-2026', 'hotel', 'confirmed', '上海南附近酒店', NULL, 'date_range', NULL, NULL, '2026-09-23', '2026-09-24', 'Asia/Shanghai', '0d0a9886-a13b-4910-81af-43ca152d88f0', NULL, NULL, 23066, 'CNY', NULL, '已确认；具体酒店 POI 暂未绑定', 1, NULL, 'member-nini', '2026-09-01T00:00:00.000Z', '2026-09-02T00:59:32.303Z', NULL);
INSERT INTO "booking_participants" ("booking_id", "member_id", "role", "created_at") VALUES ('booking-shanghai-hangzhou-flight-szx-sha-20260923', 'member-nini', 'covered', '2026-09-02T00:00:00.000Z');
INSERT INTO "booking_participants" ("booking_id", "member_id", "role", "created_at") VALUES ('booking-shanghai-hangzhou-hotel-shanghai-20260923', 'member-liu-xu', 'covered', '2026-09-02T00:59:32.303Z');
INSERT INTO "booking_participants" ("booking_id", "member_id", "role", "created_at") VALUES ('booking-shanghai-hangzhou-hotel-shanghai-20260923', 'member-nini', 'covered', '2026-09-02T00:59:32.303Z');
INSERT INTO "booking_participants" ("booking_id", "member_id", "role", "created_at") VALUES ('booking-shanghai-hangzhou-hotel-shanghai-20260923', 'member-sun-yan', 'covered', '2026-09-02T00:59:32.303Z');
INSERT INTO "booking_participants" ("booking_id", "member_id", "role", "created_at") VALUES ('booking-shanghai-hangzhou-hotel-shanghai-20260923', 'member-wang-jingwen', 'covered', '2026-09-02T00:59:32.303Z');
INSERT INTO "booking_cost_lines" ("id", "booking_id", "title", "service_start_date", "service_end_date", "amount_minor", "currency", "allocation_mode", "sort_order", "notes", "created_at", "updated_at") VALUES ('booking-cost-flight-y87578', 'booking-shanghai-hangzhou-flight-szx-sha-20260923', '深圳 → 上海机票', '2026-09-23', '2026-09-23', 48000, 'CNY', 'custom', 99, 'nini承担；航班号 Y87578', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z');
INSERT INTO "booking_cost_lines" ("id", "booking_id", "title", "service_start_date", "service_end_date", "amount_minor", "currency", "allocation_mode", "sort_order", "notes", "created_at", "updated_at") VALUES ('costline-hangzhou-hotel-first-night', 'booking-shanghai-hangzhou-hotel-hangzhou-20260924', '第一晚', '2026-09-24', '2026-09-25', 17100, 'CNY', 'equal', 1, '朱婧琪不参与第一晚房费', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_lines" ("id", "booking_id", "title", "service_start_date", "service_end_date", "amount_minor", "currency", "allocation_mode", "sort_order", "notes", "created_at", "updated_at") VALUES ('costline-hangzhou-hotel-last-two-nights', 'booking-shanghai-hangzhou-hotel-hangzhou-20260924', '后两晚合计', '2026-09-25', '2026-09-27', 58180, 'CNY', 'equal', 2, '当前按5位成员均摊；未来可改为 custom allocation', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-first-night-liu-xu', 'costline-hangzhou-hotel-first-night', 'member-liu-xu', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-first-night-nini', 'costline-hangzhou-hotel-first-night', 'member-nini', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-first-night-sun-yan', 'costline-hangzhou-hotel-first-night', 'member-sun-yan', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-first-night-wang-jingwen', 'costline-hangzhou-hotel-first-night', 'member-wang-jingwen', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-last-two-nights-liu-xu', 'costline-hangzhou-hotel-last-two-nights', 'member-liu-xu', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-last-two-nights-nini', 'costline-hangzhou-hotel-last-two-nights', 'member-nini', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-last-two-nights-sun-yan', 'costline-hangzhou-hotel-last-two-nights', 'member-sun-yan', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-last-two-nights-wang-jingwen', 'costline-hangzhou-hotel-last-two-nights', 'member-wang-jingwen', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('allocation-hangzhou-hotel-last-two-nights-zhu-jingqi', 'costline-hangzhou-hotel-last-two-nights', 'member-zhu-jingqi', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
INSERT INTO "booking_cost_allocations" ("id", "cost_line_id", "member_id", "amount_minor", "notes", "created_at", "updated_at") VALUES ('booking-cost-flight-y87578-nini', 'booking-cost-flight-y87578', 'member-nini', 48000, '本人机票', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z');
INSERT INTO "day_member_presence" ("id", "trip_id", "day_id", "member_id", "state", "starts_at", "ends_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('1a62fa50-7bd4-41d2-8154-98a6bc343a92', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'member-zhu-jingqi', 'absent', NULL, NULL, 'member-nini', 'member-nini', '2026-09-01T13:11:40.571Z', '2026-09-01T16:25:55.897Z');
INSERT INTO "day_member_presence" ("id", "trip_id", "day_id", "member_id", "state", "starts_at", "ends_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('30f2d544-4781-44fe-9efe-7cc1baedd8cc', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'member-liu-xu', 'present', '2026-09-22T16:00:00.000Z', '2026-09-23T16:00:00.000Z', 'member-nini', 'member-nini', '2026-09-01T13:11:40.571Z', '2026-09-01T16:25:55.897Z');
INSERT INTO "day_member_presence" ("id", "trip_id", "day_id", "member_id", "state", "starts_at", "ends_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('3e56734f-c687-4246-a857-1cde25d500ca', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'member-wang-jingwen', 'present', '2026-09-22T16:00:00.000Z', '2026-09-23T16:00:00.000Z', 'member-nini', 'member-nini', '2026-09-01T13:11:40.571Z', '2026-09-01T16:25:55.897Z');
INSERT INTO "day_member_presence" ("id", "trip_id", "day_id", "member_id", "state", "starts_at", "ends_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('9527ecbf-e479-4486-84f3-ee47aeeac916', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'member-nini', 'present', '2026-09-22T16:00:00.000Z', '2026-09-23T16:00:00.000Z', 'member-nini', 'member-nini', '2026-09-01T13:11:40.571Z', '2026-09-01T16:25:55.897Z');
INSERT INTO "day_member_presence" ("id", "trip_id", "day_id", "member_id", "state", "starts_at", "ends_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('e6f32ae2-8531-42d1-9611-94c009048b7b', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'member-sun-yan', 'present', '2026-09-22T16:00:00.000Z', '2026-09-23T16:00:00.000Z', 'member-nini', 'member-nini', '2026-09-01T13:11:40.571Z', '2026-09-01T16:25:55.897Z');
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('1b451b6d-ee4b-42ab-9e73-f0646c29c12b', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', NULL, 'recommendation-shanghai-disney', 'place-shanghai-disney', NULL, NULL, 'place', '上海迪士尼', NULL, NULL, NULL, 5, NULL, 'member-nini', 'member-nini', '2026-09-01T02:57:59.759Z', '2026-09-01T02:57:59.759Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day1-disney', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-shanghai-disney', 'place-shanghai-disney', NULL, NULL, 'place', '上海迪士尼', NULL, NULL, NULL, 1, NULL, NULL, 'member-nini', '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z', NULL, 'opening_hours', '营业时间待确认');
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day2-oriental-pearl', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-oriental-pearl', 'place-oriental-pearl', NULL, NULL, 'place', '东方明珠', NULL, NULL, NULL, 3, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day2-shanghai-to-hangzhou', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', NULL, NULL, NULL, NULL, NULL, 'transit', '上海 → 杭州', '交通方式和车次待确认', NULL, NULL, 4, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day2-the-bund', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-the-bund', 'place-the-bund', NULL, NULL, 'place', '外滩', NULL, NULL, NULL, 2, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day2-wukang-building', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-wukang-building', NULL, NULL, NULL, 'place', '武康大楼', NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day3-caishen-temple', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-caishen-temple', NULL, NULL, NULL, 'place', '财神庙', '具体 POI 待确认', NULL, NULL, 2, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day3-lingyin-temple', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-lingyin-temple', NULL, NULL, NULL, 'place', '灵隐寺', NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day3-west-lake', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-west-lake', NULL, NULL, NULL, 'place', '西湖', NULL, NULL, NULL, 3, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_items" ("id", "trip_id", "day_id", "stage_id", "recommendation_id", "place_id", "origin_place_id", "destination_place_id", "item_type", "title", "note", "start_time_local", "duration_minutes", "sort_order", "locked_at", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at", "end_time_local", "time_mode", "opening_hours_note") VALUES ('itinerary-shanghai-hangzhou-day4-tonglu', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-4', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-tonglu-day-guide', NULL, NULL, NULL, 'activity', '桐庐一日攻略 / 桐庐往返', '具体地点和交通待补充', NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL, 'untimed', NULL);
INSERT INTO "itinerary_item_participant_overrides" ("itinerary_item_id", "member_id", "participation", "note", "created_at", "updated_at") VALUES ('itinerary-shanghai-hangzhou-day1-disney', 'member-liu-xu', 'included', NULL, '2026-09-01T13:10:48.742Z', '2026-09-01T13:10:48.742Z');
INSERT INTO "itinerary_item_participant_overrides" ("itinerary_item_id", "member_id", "participation", "note", "created_at", "updated_at") VALUES ('itinerary-shanghai-hangzhou-day1-disney', 'member-nini', 'included', NULL, '2026-09-01T13:10:48.742Z', '2026-09-01T13:10:48.742Z');
INSERT INTO "itinerary_item_participant_overrides" ("itinerary_item_id", "member_id", "participation", "note", "created_at", "updated_at") VALUES ('itinerary-shanghai-hangzhou-day1-disney', 'member-sun-yan', 'included', NULL, '2026-09-01T13:10:48.742Z', '2026-09-01T13:10:48.742Z');
INSERT INTO "itinerary_item_participant_overrides" ("itinerary_item_id", "member_id", "participation", "note", "created_at", "updated_at") VALUES ('itinerary-shanghai-hangzhou-day1-disney', 'member-wang-jingwen', 'included', NULL, '2026-09-01T13:10:48.742Z', '2026-09-01T13:10:48.742Z');
INSERT INTO "itinerary_item_participant_overrides" ("itinerary_item_id", "member_id", "participation", "note", "created_at", "updated_at") VALUES ('itinerary-shanghai-hangzhou-day1-disney', 'member-zhu-jingqi', 'excluded', NULL, '2026-09-01T13:10:48.742Z', '2026-09-01T13:10:48.742Z');
INSERT INTO "route_preferences" ("id", "trip_id", "day_id", "from_source", "from_id", "to_source", "to_id", "member_id", "preferred_mode", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('3dda1718-4670-4093-92c9-0781d5662c26', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'booking', 'booking-shanghai-hangzhou-hotel-shanghai-20260923', 'itinerary', 'itinerary-shanghai-hangzhou-day1-disney', 'member-nini', 'walking', 'member-nini', 'member-nini', '2026-09-01T16:37:31.731Z', '2026-09-02T04:39:43.937Z');
INSERT INTO "route_preferences" ("id", "trip_id", "day_id", "from_source", "from_id", "to_source", "to_id", "member_id", "preferred_mode", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('7d81bdb8-f556-4e36-a53c-1caddc28c8c4', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'itinerary', 'itinerary-shanghai-hangzhou-day2-the-bund', 'itinerary', 'itinerary-shanghai-hangzhou-day2-oriental-pearl', 'member-nini', 'subway', 'member-nini', 'member-nini', '2026-09-01T07:37:40.309Z', '2026-09-01T07:39:16.323Z');
INSERT INTO "day_timeline_positions" ("id", "trip_id", "day_id", "source_type", "source_id", "anchor_type", "sort_order", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('029f892d-9c5e-4f7b-8117-929b2fea4510', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'booking_anchor', 'booking-shanghai-hangzhou-flight-szx-sha-20260923', 'other', 0, 'member-nini', 'member-nini', '2026-09-01T13:09:57.878Z', '2026-09-02T04:37:43.808Z');
INSERT INTO "day_timeline_positions" ("id", "trip_id", "day_id", "source_type", "source_id", "anchor_type", "sort_order", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('8f2e1d86-b373-4251-bf32-908a401b39d6', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'booking_anchor', 'booking-shanghai-hangzhou-hotel-shanghai-20260923', 'departure', 2, 'member-nini', 'member-nini', '2026-09-01T13:09:57.878Z', '2026-09-02T04:37:43.808Z');
INSERT INTO "day_timeline_positions" ("id", "trip_id", "day_id", "source_type", "source_id", "anchor_type", "sort_order", "created_by_member_id", "updated_by_member_id", "created_at", "updated_at") VALUES ('96286ed3-99cc-46df-a1a5-a35b987abd0f', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'itinerary_item', 'itinerary-shanghai-hangzhou-day1-disney', 'other', 1, 'member-nini', 'member-nini', '2026-09-01T13:09:57.878Z', '2026-09-02T04:37:43.808Z');

