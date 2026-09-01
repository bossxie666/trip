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
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_expense_allocations_expense_member` ON `expense_allocations` (`expense_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_allocations_member` ON `expense_allocations` (`member_id`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX `idx_expenses_trip_date` ON `expenses` (`trip_id`,`occurred_date`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_expenses_trip_creator` ON `expenses` (`trip_id`,`created_by_member_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_expenses_day` ON `expenses` (`day_id`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_member_budget_plans_trip_member_category` ON `member_budget_plans` (`trip_id`,`member_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_member_budget_plans_trip_member` ON `member_budget_plans` (`trip_id`,`member_id`);