CREATE TABLE `product_location_stock_levels` (
	`product_id` int NOT NULL,
	`location_id` int NOT NULL,
	`minimum_stock_level` int unsigned NOT NULL DEFAULT 0,
	`updated_at` bigint unsigned NOT NULL,
	`updated_by` int NOT NULL,
	CONSTRAINT `product_location_stock_levels_product_id_location_id_pk` PRIMARY KEY(`product_id`,`location_id`)
);
--> statement-breakpoint
ALTER TABLE `product_location_stock_levels` ADD CONSTRAINT `product_location_stock_levels_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `product_location_stock_levels` ADD CONSTRAINT `product_location_stock_levels_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `product_location_stock_levels` ADD CONSTRAINT `product_location_stock_levels_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `product_location_stock_levels_location_id_idx` ON `product_location_stock_levels` (`location_id`);
