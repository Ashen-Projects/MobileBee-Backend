ALTER TABLE `purchase_orders` MODIFY COLUMN `supplier_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `status` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `location_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `po_number` varchar(100);--> statement-breakpoint
UPDATE `purchase_orders`
SET `po_number` = CONCAT('PO-LEGACY-', LPAD(`id`, 6, '0'))
WHERE `po_number` IS NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `po_number` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_po_number_uq` UNIQUE(`po_number`);
