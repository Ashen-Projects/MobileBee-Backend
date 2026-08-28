ALTER TABLE `products` ADD `sku` varchar(100);--> statement-breakpoint
ALTER TABLE `products` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_sku_uq` UNIQUE(`sku`);--> statement-breakpoint
CREATE INDEX `products_is_active_idx` ON `products` (`is_active`);