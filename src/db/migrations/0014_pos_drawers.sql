CREATE TABLE `pos_drawers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`user_id` int NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`opening_cash` decimal(12,2) NOT NULL DEFAULT '0.00',
	`counted_cash` decimal(12,2),
	`counted_card_total` decimal(12,2),
	`counted_bank_transfer_total` decimal(12,2),
	`cash_expense_amount` decimal(12,2),
	`open_note` text,
	`close_note` text,
	`opened_at` bigint unsigned NOT NULL,
	`closed_at` bigint unsigned,
	`opened_by` int NOT NULL,
	`closed_by` int,
	CONSTRAINT `pos_drawers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sales` ADD `drawer_id` int;
--> statement-breakpoint
ALTER TABLE `pos_drawers` ADD CONSTRAINT `pos_drawers_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `pos_drawers` ADD CONSTRAINT `pos_drawers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `pos_drawers` ADD CONSTRAINT `pos_drawers_opened_by_users_id_fk` FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `pos_drawers` ADD CONSTRAINT `pos_drawers_closed_by_users_id_fk` FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_drawer_id_pos_drawers_id_fk` FOREIGN KEY (`drawer_id`) REFERENCES `pos_drawers`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `pos_drawers_user_status_idx` ON `pos_drawers` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `pos_drawers_location_status_idx` ON `pos_drawers` (`location_id`,`status`);
--> statement-breakpoint
CREATE INDEX `pos_drawers_opened_at_idx` ON `pos_drawers` (`opened_at`);
--> statement-breakpoint
CREATE INDEX `sales_drawer_id_idx` ON `sales` (`drawer_id`);
