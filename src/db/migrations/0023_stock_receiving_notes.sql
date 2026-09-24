CREATE TABLE `grn_stock_receipts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `grn_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `location_id` int NOT NULL,
  `created_by` int NOT NULL,
  `note_number` varchar(100) NOT NULL,
  `supplier_code` varchar(100) NOT NULL,
  `supplier_name` varchar(255) NOT NULL,
  `location_name` varchar(255) NOT NULL,
  `timestamp` bigint unsigned NOT NULL,
  CONSTRAINT `grn_stock_receipts_id` PRIMARY KEY(`id`),
  CONSTRAINT `grn_stock_receipts_note_number_uq` UNIQUE(`note_number`)
);
--> statement-breakpoint
CREATE TABLE `grn_stock_receipt_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `stock_receipt_id` int NOT NULL,
  `grn_item_id` int NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(500) NOT NULL,
  `product_sku` varchar(100),
  `quantity` int NOT NULL,
  `unit_cost` decimal(10,2) NOT NULL,
  `mrp_price` decimal(10,2) NOT NULL,
  CONSTRAINT `grn_stock_receipt_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grn_stock_receipt_units` (
  `id` int AUTO_INCREMENT NOT NULL,
  `stock_receipt_item_id` int NOT NULL,
  `stock_id` int NOT NULL,
  `barcode` varchar(64),
  CONSTRAINT `grn_stock_receipt_units_id` PRIMARY KEY(`id`),
  CONSTRAINT `grn_stock_receipt_units_stock_id_uq` UNIQUE(`stock_id`)
);
--> statement-breakpoint
ALTER TABLE `grn_stock_receipts` ADD CONSTRAINT `grn_stock_receipts_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipts` ADD CONSTRAINT `grn_stock_receipts_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipts` ADD CONSTRAINT `grn_stock_receipts_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipts` ADD CONSTRAINT `grn_stock_receipts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipt_items` ADD CONSTRAINT `grn_stock_receipt_items_receipt_id_grn_stock_receipts_id_fk` FOREIGN KEY (`stock_receipt_id`) REFERENCES `grn_stock_receipts`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipt_items` ADD CONSTRAINT `grn_stock_receipt_items_grn_item_id_grn_items_id_fk` FOREIGN KEY (`grn_item_id`) REFERENCES `grn_items`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipt_items` ADD CONSTRAINT `grn_stock_receipt_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipt_units` ADD CONSTRAINT `gsru_receipt_item_fk` FOREIGN KEY (`stock_receipt_item_id`) REFERENCES `grn_stock_receipt_items`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `grn_stock_receipt_units` ADD CONSTRAINT `gsru_stock_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `grn_stock_receipts_location_timestamp_idx` ON `grn_stock_receipts` (`location_id`,`timestamp`);
--> statement-breakpoint
