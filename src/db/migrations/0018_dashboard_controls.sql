CREATE TABLE `dashboard_insight_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`insight_id` varchar(120) NOT NULL,
	`scope_key` varchar(32) NOT NULL,
	`location_id` int,
	`state` enum('open','resolved','dismissed') NOT NULL DEFAULT 'open',
	`note` text,
	`acted_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `dashboard_insight_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_insight_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dead_stock_days` int NOT NULL DEFAULT 60,
	`slow_stock_days` int NOT NULL DEFAULT 30,
	`excess_stock_cover_days` int NOT NULL DEFAULT 90,
	`stockout_cover_days` int NOT NULL DEFAULT 7,
	`sales_decline_percent` decimal(5,2) NOT NULL DEFAULT '10.00',
	`suggested_target_growth_percent` decimal(5,2) NOT NULL DEFAULT '10.00',
	`overdue_supplier_days` int NOT NULL DEFAULT 1,
	`repair_intake_days` int NOT NULL DEFAULT 2,
	`repair_waiting_parts_days` int NOT NULL DEFAULT 5,
	`repair_in_progress_days` int NOT NULL DEFAULT 3,
	`updated_by` int NOT NULL,
	`updated_at` bigint unsigned NOT NULL,
	CONSTRAINT `dashboard_insight_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`period` enum('weekly','monthly') NOT NULL,
	`target_amount` decimal(14,2) NOT NULL,
	`effective_from` date NOT NULL,
	`effective_to` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`updated_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	`updated_at` bigint unsigned NOT NULL,
	CONSTRAINT `dashboard_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dashboard_insight_actions` ADD CONSTRAINT `dashboard_insight_actions_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dashboard_insight_actions` ADD CONSTRAINT `dashboard_insight_actions_acted_by_users_id_fk` FOREIGN KEY (`acted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dashboard_insight_settings` ADD CONSTRAINT `dashboard_insight_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dashboard_targets` ADD CONSTRAINT `dashboard_targets_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dashboard_targets` ADD CONSTRAINT `dashboard_targets_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dashboard_targets` ADD CONSTRAINT `dashboard_targets_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `dashboard_insight_actions_insight_idx` ON `dashboard_insight_actions` (`insight_id`);
--> statement-breakpoint
CREATE INDEX `dashboard_insight_actions_location_idx` ON `dashboard_insight_actions` (`location_id`);
--> statement-breakpoint
CREATE INDEX `dashboard_insight_actions_timestamp_idx` ON `dashboard_insight_actions` (`timestamp`);
--> statement-breakpoint
CREATE INDEX `dashboard_insight_actions_scope_history_idx` ON `dashboard_insight_actions` (`scope_key`,`insight_id`,`timestamp`);
--> statement-breakpoint
CREATE INDEX `dashboard_targets_location_period_idx` ON `dashboard_targets` (`location_id`,`period`);
--> statement-breakpoint
CREATE INDEX `dashboard_targets_active_idx` ON `dashboard_targets` (`is_active`);
--> statement-breakpoint
CREATE INDEX `dashboard_targets_effective_idx` ON `dashboard_targets` (`effective_from`,`effective_to`);
