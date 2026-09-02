CREATE TABLE `grn_count_item_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`count_session_id` int NOT NULL,
	`grn_item_id` int NOT NULL,
	`counted_quantity` int NOT NULL,
	CONSTRAINT `grn_count_item_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `grn_count_item_entries_session_item_uq` UNIQUE(`count_session_id`,`grn_item_id`)
);
--> statement-breakpoint
ALTER TABLE `grn_items` ADD `stocked_quantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `grn_items` AS `grn_item`
LEFT JOIN (
  SELECT `grn_id`, `product_id`, COUNT(*) AS `stocked_quantity`
  FROM `stock`
  WHERE `grn_id` IS NOT NULL
  GROUP BY `grn_id`, `product_id`
) AS `stock_totals`
  ON `stock_totals`.`grn_id` = `grn_item`.`grn_id`
  AND `stock_totals`.`product_id` = `grn_item`.`product_id`
SET `grn_item`.`stocked_quantity` = COALESCE(`stock_totals`.`stocked_quantity`, 0)
WHERE `grn_item`.`id` > 0;--> statement-breakpoint
ALTER TABLE `grn_count_item_entries` ADD CONSTRAINT `grn_count_item_entries_count_session_id_grn_count_sessions_id_fk` FOREIGN KEY (`count_session_id`) REFERENCES `grn_count_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_count_item_entries` ADD CONSTRAINT `grn_count_item_entries_grn_item_id_grn_items_id_fk` FOREIGN KEY (`grn_item_id`) REFERENCES `grn_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `grn_count_item_entries_grn_item_idx` ON `grn_count_item_entries` (`grn_item_id`);
