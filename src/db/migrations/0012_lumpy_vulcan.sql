CREATE TABLE `grn_count_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`count_session_id` int NOT NULL,
	`stock_id` int NOT NULL,
	`scanned_code` varchar(64) NOT NULL,
	CONSTRAINT `grn_count_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `grn_count_entries_session_stock_uq` UNIQUE(`count_session_id`,`stock_id`)
);
--> statement-breakpoint
CREATE TABLE `grn_count_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grn_id` int NOT NULL,
	`count_number` enum('first','second') NOT NULL,
	`counted_by` int NOT NULL,
	`is_matched` boolean NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `grn_count_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `grn_count_sessions_grn_count_uq` UNIQUE(`grn_id`,`count_number`)
);
--> statement-breakpoint
CREATE TABLE `grn_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grn_id` int NOT NULL,
	`purchase_order_item_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`unit_cost` decimal(10,2) NOT NULL,
	`total_amount` decimal(12,2) NOT NULL,
	CONSTRAINT `grn_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `grn_items_grn_po_item_uq` UNIQUE(`grn_id`,`purchase_order_item_id`)
);
--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `location_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `purchase_order_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `supplier_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `added_by` int NOT NULL;--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `status` enum('pendingCountApproval','pendingFinanceApproval','approved','declined') NOT NULL DEFAULT 'pendingCountApproval';--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `cost_total` decimal(12,2) NOT NULL DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `payment_status` enum('unpaid','partiallyPaid','paid') NOT NULL DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `grns` ADD `grn_number` varchar(100);--> statement-breakpoint
UPDATE `grns`
SET `grn_number` = CONCAT('GRN-LEGACY-', LPAD(`id`, 6, '0'))
WHERE `grn_number` IS NULL
  AND `id` > 0;--> statement-breakpoint
ALTER TABLE `grns` MODIFY COLUMN `grn_number` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `grns` ADD `supplier_delivery_note` varchar(150);--> statement-breakpoint
ALTER TABLE `grns` ADD `note` text;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_grn_number_uq` UNIQUE(`grn_number`);--> statement-breakpoint
ALTER TABLE `grn_count_entries` ADD CONSTRAINT `grn_count_entries_count_session_id_grn_count_sessions_id_fk` FOREIGN KEY (`count_session_id`) REFERENCES `grn_count_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_count_entries` ADD CONSTRAINT `grn_count_entries_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_count_sessions` ADD CONSTRAINT `grn_count_sessions_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_count_sessions` ADD CONSTRAINT `grn_count_sessions_counted_by_users_id_fk` FOREIGN KEY (`counted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_items` ADD CONSTRAINT `grn_items_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_items` ADD CONSTRAINT `grn_items_purchase_order_item_id_purchase_order_items_id_fk` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_items` ADD CONSTRAINT `grn_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `grn_count_entries_stock_id_idx` ON `grn_count_entries` (`stock_id`);--> statement-breakpoint
CREATE INDEX `grn_count_sessions_counted_by_idx` ON `grn_count_sessions` (`counted_by`);--> statement-breakpoint
CREATE INDEX `grn_items_po_item_idx` ON `grn_items` (`purchase_order_item_id`);--> statement-breakpoint
CREATE INDEX `grn_items_product_idx` ON `grn_items` (`product_id`);
