CREATE TABLE `stock_identifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stock_id` int NOT NULL,
	`type` enum('imei','serial') NOT NULL,
	`value` varchar(64) NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	CONSTRAINT `stock_identifiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_identifiers_value_uq` UNIQUE(`value`)
);
--> statement-breakpoint
ALTER TABLE `stock` RENAME COLUMN `code` TO `barcode`;--> statement-breakpoint
ALTER TABLE `stock` DROP INDEX `stock_code_uq`;--> statement-breakpoint
ALTER TABLE `stock` MODIFY COLUMN `barcode` varchar(64);--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_barcode_uq` UNIQUE(`barcode`);--> statement-breakpoint
ALTER TABLE `stock_identifiers` ADD CONSTRAINT `stock_identifiers_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_identifiers_stock_id_idx` ON `stock_identifiers` (`stock_id`);--> statement-breakpoint
CREATE INDEX `stock_identifiers_stock_type_idx` ON `stock_identifiers` (`stock_id`,`type`);