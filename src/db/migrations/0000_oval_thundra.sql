CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`module` varchar(100) NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` int,
	`old_values` json,
	`new_values` json,
	`ip_address` varchar(45),
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(30),
	`email` varchar(255),
	`nic` varchar(50),
	`address` text,
	`timestamp` bigint unsigned NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_no` varchar(100) NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	`location_id` int NOT NULL,
	`customer_id` int,
	`user_id` int NOT NULL,
	`sub_total` decimal(12,2) NOT NULL,
	`discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_amount` decimal(12,2) NOT NULL,
	`paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`status` enum('draft','completed','cancelled','returned') NOT NULL DEFAULT 'completed',
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_invoice_no_uq` UNIQUE(`invoice_no`)
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total_amount` decimal(12,2) NOT NULL,
	CONSTRAINT `sale_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sale_item_stock` (
	`sale_item_id` int NOT NULL,
	`stock_id` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `sale_item_stock_sale_item_id_stock_id_pk` PRIMARY KEY(`sale_item_id`,`stock_id`),
	CONSTRAINT `sale_item_stock_stock_id_uq` UNIQUE(`stock_id`)
);
--> statement-breakpoint
CREATE TABLE `sale_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`method` enum('cash','card','bankTransfer','finance','mobile') NOT NULL,
	`reference_no` varchar(255),
	`received_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `sale_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sale_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_return_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`method` enum('cash','cardReversal','bankTransfer','creditNote') NOT NULL,
	`reference_no` varchar(255),
	`processed_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `sale_refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sale_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`return_no` varchar(100) NOT NULL,
	`sale_id` int NOT NULL,
	`location_id` int NOT NULL,
	`customer_id` int,
	`status` enum('pending','approved','rejected','refunded') NOT NULL DEFAULT 'pending',
	`total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`reason` text NOT NULL,
	`created_by` int NOT NULL,
	`approved_by` int,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `sale_returns_id` PRIMARY KEY(`id`),
	CONSTRAINT `sale_returns_return_no_uq` UNIQUE(`return_no`)
);
--> statement-breakpoint
CREATE TABLE `sale_return_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_return_id` int NOT NULL,
	`sale_item_id` int NOT NULL,
	`stock_id` int,
	`quantity` int NOT NULL DEFAULT 1,
	`refund_amount` decimal(12,2) NOT NULL,
	`condition` enum('sealed','opened','damaged','defective') NOT NULL,
	`restock_status` int,
	CONSTRAINT `sale_return_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`short_description` varchar(1024),
	`description` text,
	`lowest_selling_price` decimal(10,2) NOT NULL,
	`mrp_price` decimal(10,2) NOT NULL,
	`max_purchasing_price` decimal(10,2) NOT NULL,
	`parent_id` int,
	`category_id` int,
	`priority` int,
	`icon_url` varchar(1024),
	`logo_url` varchar(1024),
	`seo_id` int,
	`is_available_on_web` boolean NOT NULL DEFAULT false,
	`has_variations` boolean NOT NULL DEFAULT false,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`display_name` varchar(150) NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_attributes_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `product_attribute_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attribute_id` int NOT NULL,
	`value` varchar(150) NOT NULL,
	`label` varchar(150) NOT NULL,
	`color_hex` varchar(7),
	`priority` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_attribute_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_attribute_options_attribute_value_uq` UNIQUE(`attribute_id`,`value`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`parent_id` int,
	`priority` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_categories_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `product_categories_name_parent_uq` UNIQUE(`name`,`parent_id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`url` varchar(1024) NOT NULL,
	`alt_text` varchar(255),
	`priority` int NOT NULL DEFAULT 0,
	`is_primary` boolean NOT NULL DEFAULT false,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_product_attribute_options` (
	`product_id` int NOT NULL,
	`option_id` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `product_product_attribute_options_product_id_option_id_pk` PRIMARY KEY(`product_id`,`option_id`)
);
--> statement-breakpoint
CREATE TABLE `seo` (
	`seo_id` int AUTO_INCREMENT NOT NULL,
	`meta_title` varchar(255),
	`meta_description` varchar(512),
	`keywords` varchar(512),
	`canonical_url` varchar(1024),
	`og_image_url` varchar(1024),
	CONSTRAINT `seo_seo_id` PRIMARY KEY(`seo_id`)
);
--> statement-breakpoint
CREATE TABLE `grns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	`location_id` int,
	`purchase_order_id` int,
	`supplier_id` int,
	`added_by` int,
	`counted_by` int,
	`counted2_by` int,
	`finance_approved_by` int,
	`status` enum('pendingCountApproval','pendingFinanceApproval','approved','declined') DEFAULT 'pendingCountApproval',
	`cost_total` decimal(12,2) DEFAULT '0.00',
	`payment_status` enum('unpaid','partiallyPaid','paid') DEFAULT 'unpaid',
	`paid_amount` decimal(12,2) DEFAULT '0.00',
	CONSTRAINT `grns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grn_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grn_id` int NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` varchar(1024) NOT NULL,
	`document_type` varchar(80) NOT NULL,
	`uploaded_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `grn_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grn_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grn_id` int NOT NULL,
	`user_id` int NOT NULL,
	`previous_status` varchar(60),
	`new_status` varchar(60),
	`action` varchar(100) NOT NULL,
	`note` text,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `grn_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	`supplier_id` int,
	`total_amount` decimal(10,2) NOT NULL,
	`status` int DEFAULT 1,
	`location_id` int,
	`user_id` int,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchase_order_id` int NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` varchar(1024) NOT NULL,
	`document_type` varchar(80),
	`uploaded_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `purchase_order_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchase_order_id` int NOT NULL,
	`supplier_product_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`received_quantity` int NOT NULL DEFAULT 0,
	`unit_price` decimal(10,2) NOT NULL,
	`total_amount` decimal(12,2) NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_order_items_po_supplier_product_uq` UNIQUE(`purchase_order_id`,`supplier_product_id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchase_order_id` int NOT NULL,
	`user_id` int NOT NULL,
	`previous_status` int,
	`new_status` int,
	`action` varchar(100) NOT NULL,
	`note` text,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `purchase_order_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`label` varchar(150) NOT NULL,
	`is_final` boolean NOT NULL DEFAULT false,
	`priority` int NOT NULL DEFAULT 0,
	CONSTRAINT `purchase_order_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_order_statuses_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `purchase_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`return_no` varchar(100) NOT NULL,
	`supplier_id` int NOT NULL,
	`grn_id` int,
	`location_id` int NOT NULL,
	`status` enum('draft','approved','dispatched','credited','cancelled') NOT NULL DEFAULT 'draft',
	`total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`reason` text NOT NULL,
	`created_by` int NOT NULL,
	`approved_by` int,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `purchase_returns_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_returns_return_no_uq` UNIQUE(`return_no`)
);
--> statement-breakpoint
CREATE TABLE `purchase_return_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchase_return_id` int NOT NULL,
	`stock_id` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`condition_note` varchar(512),
	CONSTRAINT `purchase_return_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_return_items_stock_id_uq` UNIQUE(`stock_id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`contact_person` varchar(255),
	`phone` varchar(30),
	`email` varchar(255),
	`address` text,
	`credit_limit` decimal(12,2) DEFAULT '0.00',
	`payment_term_days` int DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_name_uq` UNIQUE(`name`),
	CONSTRAINT `suppliers_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `supplier_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`product_id` int NOT NULL,
	`supplier_product_code` varchar(255),
	`supplier_product_name` varchar(255),
	`last_purchasing_price` decimal(10,2),
	`quoted_price` decimal(10,2),
	`minimum_order_qty` int NOT NULL DEFAULT 1,
	`lead_time_days` int,
	`is_preferred` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `supplier_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_products_supplier_product_uq` UNIQUE(`supplier_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_no` varchar(100) NOT NULL,
	`supplier_id` int NOT NULL,
	`grn_id` int NOT NULL,
	`invoice_date` bigint unsigned NOT NULL,
	`due_date` bigint unsigned,
	`sub_total` decimal(12,2) NOT NULL,
	`tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_amount` decimal(12,2) NOT NULL,
	`paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`status` enum('unpaid','partiallyPaid','paid','cancelled') NOT NULL DEFAULT 'unpaid',
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `supplier_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_invoices_invoice_supplier_uq` UNIQUE(`invoice_no`,`supplier_id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payment_no` varchar(100) NOT NULL,
	`supplier_id` int NOT NULL,
	`supplier_invoice_id` int,
	`grn_id` int,
	`amount` decimal(12,2) NOT NULL,
	`method` enum('cash','bankTransfer','cheque','card') NOT NULL,
	`reference_no` varchar(255),
	`paid_by` int NOT NULL,
	`payment_date` bigint unsigned NOT NULL,
	`note` text,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `supplier_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_payments_payment_no_uq` UNIQUE(`payment_no`)
);
--> statement-breakpoint
CREATE TABLE `repair_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repair_job_id` int NOT NULL,
	`document_type` enum('intakePhoto','estimate','approval','repairPhoto','deliveryProof','other') NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` varchar(1024) NOT NULL,
	`uploaded_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `repair_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repair_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repair_job_id` int NOT NULL,
	`user_id` int NOT NULL,
	`old_status` varchar(80),
	`new_status` varchar(80) NOT NULL,
	`note` text,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `repair_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repair_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_no` varchar(100) NOT NULL,
	`customer_id` int NOT NULL,
	`location_id` int NOT NULL,
	`added_by` int NOT NULL,
	`assigned_to` int,
	`device_name` varchar(255) NOT NULL,
	`serial_imei` varchar(255),
	`problem_description` text NOT NULL,
	`status` enum('received','inspection','waitingParts','inProgress','completed','delivered','cancelled') NOT NULL DEFAULT 'received',
	`estimated_cost` decimal(12,2) DEFAULT '0.00',
	`final_cost` decimal(12,2) DEFAULT '0.00',
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `repair_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `repair_jobs_job_no_uq` UNIQUE(`job_no`)
);
--> statement-breakpoint
CREATE TABLE `repair_labour` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repair_job_id` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`technician_id` int,
	`hours` decimal(6,2),
	`amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `repair_labour_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repair_parts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repair_job_id` int NOT NULL,
	`stock_id` int,
	`product_id` int,
	`description` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `repair_parts_id` PRIMARY KEY(`id`),
	CONSTRAINT `repair_parts_repair_stock_uq` UNIQUE(`repair_job_id`,`stock_id`)
);
--> statement-breakpoint
CREATE TABLE `repair_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repair_job_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`method` enum('cash','card','bankTransfer','mobile') NOT NULL,
	`reference_no` varchar(255),
	`received_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `repair_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_type` varchar(50) NOT NULL,
	`location_id` int,
	`year` int NOT NULL,
	`last_number` bigint unsigned NOT NULL DEFAULT 0,
	`prefix` varchar(30) NOT NULL,
	CONSTRAINT `document_sequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_sequences_type_location_year_uq` UNIQUE(`document_type`,`location_id`,`year`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('shop','warehouse','repairCentre') NOT NULL DEFAULT 'shop',
	`phone` varchar(30),
	`address` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	`latest_available_date_time` bigint unsigned NOT NULL,
	`product_id` int,
	`code` varchar(1000) NOT NULL,
	`supplier_id` int,
	`location_id` int,
	`g_cost_price` decimal(10,2) NOT NULL,
	`cost_price` decimal(10,2) NOT NULL,
	`online_price` decimal(10,2),
	`max_retail_price` decimal(10,2),
	`is_allow_to_sell_below_cost` boolean DEFAULT false,
	`purchase_order_id` int,
	`grn_id` int,
	`status` int,
	CONSTRAINT `stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `stock_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adjustment_no` varchar(100) NOT NULL,
	`location_id` int NOT NULL,
	`reason` text NOT NULL,
	`status` enum('draft','approved','declined') NOT NULL DEFAULT 'draft',
	`created_by` int NOT NULL,
	`approved_by` int,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `stock_adjustments_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_adjustments_adjustment_no_uq` UNIQUE(`adjustment_no`)
);
--> statement-breakpoint
CREATE TABLE `stock_adjustment_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stock_adjustment_id` int NOT NULL,
	`stock_id` int NOT NULL,
	`old_status` int,
	`new_status` int,
	`old_location_id` int,
	`new_location_id` int,
	`old_cost_price` decimal(10,2),
	`new_cost_price` decimal(10,2),
	`note` varchar(512),
	CONSTRAINT `stock_adjustment_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_adjustment_items_adjustment_stock_uq` UNIQUE(`stock_adjustment_id`,`stock_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stock_id` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`previous_status` int,
	`new_status` int,
	`previous_location_id` int,
	`new_location_id` int,
	`reference_type` varchar(80),
	`reference_id` int,
	`user_id` int NOT NULL,
	`note` text,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `stock_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`label` varchar(150) NOT NULL,
	`is_sellable` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `stock_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_statuses_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transfer_no` varchar(100) NOT NULL,
	`from_location_id` int NOT NULL,
	`to_location_id` int NOT NULL,
	`status` enum('draft','dispatched','received','cancelled') NOT NULL DEFAULT 'draft',
	`created_by` int NOT NULL,
	`dispatched_by` int,
	`received_by` int,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_transfers_transfer_no_uq` UNIQUE(`transfer_no`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfer_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stock_transfer_id` int NOT NULL,
	`stock_id` int NOT NULL,
	`condition_out` varchar(255),
	`condition_in` varchar(255),
	`received_at` bigint unsigned,
	CONSTRAINT `stock_transfer_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_transfer_items_transfer_stock_uq` UNIQUE(`stock_transfer_id`,`stock_id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(150) NOT NULL,
	`module` varchar(80) NOT NULL,
	`description` varchar(255),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_uq` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`label` varchar(150) NOT NULL,
	`description` text,
	`is_system` boolean NOT NULL DEFAULT false,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` int NOT NULL,
	`permission_id` int NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_id_pk` PRIMARY KEY(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`email` varchar(255),
	`phone` varchar(30),
	`default_location_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` bigint unsigned,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_uq` UNIQUE(`username`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` int NOT NULL,
	`role_id` int NOT NULL,
	`location_id` int NOT NULL,
	`assigned_by` int NOT NULL,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `user_roles_user_id_role_id_location_id_pk` PRIMARY KEY(`user_id`,`role_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`ip_address` varchar(45),
	`user_agent` varchar(512),
	`expires_at` bigint unsigned NOT NULL,
	`revoked_at` bigint unsigned,
	`timestamp` bigint unsigned NOT NULL,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_item_stock` ADD CONSTRAINT `sale_item_stock_sale_item_id_sale_items_id_fk` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_item_stock` ADD CONSTRAINT `sale_item_stock_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_payments` ADD CONSTRAINT `sale_payments_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_payments` ADD CONSTRAINT `sale_payments_received_by_users_id_fk` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_refunds` ADD CONSTRAINT `sale_refunds_sale_return_id_sale_returns_id_fk` FOREIGN KEY (`sale_return_id`) REFERENCES `sale_returns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_refunds` ADD CONSTRAINT `sale_refunds_processed_by_users_id_fk` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_sale_return_id_sale_returns_id_fk` FOREIGN KEY (`sale_return_id`) REFERENCES `sale_returns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_sale_item_id_sale_items_id_fk` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_restock_status_stock_statuses_id_fk` FOREIGN KEY (`restock_status`) REFERENCES `stock_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_product_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_seo_id_seo_seo_id_fk` FOREIGN KEY (`seo_id`) REFERENCES `seo`(`seo_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_attribute_options` ADD CONSTRAINT `product_attribute_options_attribute_id_product_attributes_id_fk` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_product_attribute_options` ADD CONSTRAINT `ppao_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_product_attribute_options` ADD CONSTRAINT `ppao_option_fk` FOREIGN KEY (`option_id`) REFERENCES `product_attribute_options`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_added_by_users_id_fk` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_counted_by_users_id_fk` FOREIGN KEY (`counted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_counted2_by_users_id_fk` FOREIGN KEY (`counted2_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grns` ADD CONSTRAINT `grns_finance_approved_by_users_id_fk` FOREIGN KEY (`finance_approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_documents` ADD CONSTRAINT `grn_documents_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_documents` ADD CONSTRAINT `grn_documents_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_history` ADD CONSTRAINT `grn_history_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grn_history` ADD CONSTRAINT `grn_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_status_purchase_order_statuses_id_fk` FOREIGN KEY (`status`) REFERENCES `purchase_order_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_documents` ADD CONSTRAINT `purchase_order_documents_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_documents` ADD CONSTRAINT `purchase_order_documents_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_supplier_product_id_supplier_products_id_fk` FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_logs` ADD CONSTRAINT `purchase_order_logs_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_logs` ADD CONSTRAINT `purchase_order_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_logs` ADD CONSTRAINT `po_logs_previous_status_fk` FOREIGN KEY (`previous_status`) REFERENCES `purchase_order_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_logs` ADD CONSTRAINT `purchase_order_logs_new_status_purchase_order_statuses_id_fk` FOREIGN KEY (`new_status`) REFERENCES `purchase_order_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_purchase_return_id_purchase_returns_id_fk` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_products` ADD CONSTRAINT `supplier_products_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_products` ADD CONSTRAINT `supplier_products_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoices` ADD CONSTRAINT `supplier_invoices_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoices` ADD CONSTRAINT `supplier_invoices_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`supplier_invoice_id`) REFERENCES `supplier_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_paid_by_users_id_fk` FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_documents` ADD CONSTRAINT `repair_documents_repair_job_id_repair_jobs_id_fk` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_documents` ADD CONSTRAINT `repair_documents_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_history` ADD CONSTRAINT `repair_history_repair_job_id_repair_jobs_id_fk` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_history` ADD CONSTRAINT `repair_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_added_by_users_id_fk` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_assigned_to_users_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_labour` ADD CONSTRAINT `repair_labour_repair_job_id_repair_jobs_id_fk` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_labour` ADD CONSTRAINT `repair_labour_technician_id_users_id_fk` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_parts` ADD CONSTRAINT `repair_parts_repair_job_id_repair_jobs_id_fk` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_parts` ADD CONSTRAINT `repair_parts_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_parts` ADD CONSTRAINT `repair_parts_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_payments` ADD CONSTRAINT `repair_payments_repair_job_id_repair_jobs_id_fk` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repair_payments` ADD CONSTRAINT `repair_payments_received_by_users_id_fk` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_sequences` ADD CONSTRAINT `document_sequences_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_grn_id_grns_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock` ADD CONSTRAINT `stock_status_stock_statuses_id_fk` FOREIGN KEY (`status`) REFERENCES `stock_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adj_items_adjustment_fk` FOREIGN KEY (`stock_adjustment_id`) REFERENCES `stock_adjustments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_old_status_stock_statuses_id_fk` FOREIGN KEY (`old_status`) REFERENCES `stock_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_new_status_stock_statuses_id_fk` FOREIGN KEY (`new_status`) REFERENCES `stock_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_old_location_id_locations_id_fk` FOREIGN KEY (`old_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_new_location_id_locations_id_fk` FOREIGN KEY (`new_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_previous_status_stock_statuses_id_fk` FOREIGN KEY (`previous_status`) REFERENCES `stock_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_new_status_stock_statuses_id_fk` FOREIGN KEY (`new_status`) REFERENCES `stock_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_previous_location_id_locations_id_fk` FOREIGN KEY (`previous_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_new_location_id_locations_id_fk` FOREIGN KEY (`new_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_location_id_locations_id_fk` FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_location_id_locations_id_fk` FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_dispatched_by_users_id_fk` FOREIGN KEY (`dispatched_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_received_by_users_id_fk` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_stock_transfer_id_stock_transfers_id_fk` FOREIGN KEY (`stock_transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_stock_id_stock_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_default_location_id_locations_id_fk` FOREIGN KEY (`default_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_module_idx` ON `audit_logs` (`module`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_type_idx` ON `audit_logs` (`entity_type`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_id_idx` ON `audit_logs` (`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_timestamp_idx` ON `audit_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customers_nic_idx` ON `customers` (`nic`);--> statement-breakpoint
CREATE INDEX `sales_timestamp_idx` ON `sales` (`timestamp`);--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_id_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_id_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `sale_payments_sale_id_idx` ON `sale_payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_payments_method_idx` ON `sale_payments` (`method`);--> statement-breakpoint
CREATE INDEX `sale_payments_reference_no_idx` ON `sale_payments` (`reference_no`);--> statement-breakpoint
CREATE INDEX `sale_payments_timestamp_idx` ON `sale_payments` (`timestamp`);--> statement-breakpoint
CREATE INDEX `sale_refunds_sale_return_id_idx` ON `sale_refunds` (`sale_return_id`);--> statement-breakpoint
CREATE INDEX `sale_refunds_method_idx` ON `sale_refunds` (`method`);--> statement-breakpoint
CREATE INDEX `sale_refunds_timestamp_idx` ON `sale_refunds` (`timestamp`);--> statement-breakpoint
CREATE INDEX `sale_returns_status_idx` ON `sale_returns` (`status`);--> statement-breakpoint
CREATE INDEX `sale_return_items_sale_return_id_idx` ON `sale_return_items` (`sale_return_id`);--> statement-breakpoint
CREATE INDEX `sale_return_items_condition_idx` ON `sale_return_items` (`condition`);--> statement-breakpoint
CREATE INDEX `products_parent_id_idx` ON `products` (`parent_id`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_seo_id_idx` ON `products` (`seo_id`);--> statement-breakpoint
CREATE INDEX `product_attribute_options_attribute_id_idx` ON `product_attribute_options` (`attribute_id`);--> statement-breakpoint
CREATE INDEX `product_categories_parent_id_idx` ON `product_categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `product_categories_is_active_idx` ON `product_categories` (`is_active`);--> statement-breakpoint
CREATE INDEX `product_images_product_id_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `grns_location_id_idx` ON `grns` (`location_id`);--> statement-breakpoint
CREATE INDEX `grns_purchase_order_id_idx` ON `grns` (`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `grns_supplier_id_idx` ON `grns` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `grns_status_idx` ON `grns` (`status`);--> statement-breakpoint
CREATE INDEX `grns_po_status_timestamp_idx` ON `grns` (`purchase_order_id`,`status`,`timestamp`);--> statement-breakpoint
CREATE INDEX `grn_documents_grn_id_idx` ON `grn_documents` (`grn_id`);--> statement-breakpoint
CREATE INDEX `grn_documents_document_type_idx` ON `grn_documents` (`document_type`);--> statement-breakpoint
CREATE INDEX `grn_history_grn_id_idx` ON `grn_history` (`grn_id`);--> statement-breakpoint
CREATE INDEX `grn_history_new_status_idx` ON `grn_history` (`new_status`);--> statement-breakpoint
CREATE INDEX `grn_history_action_idx` ON `grn_history` (`action`);--> statement-breakpoint
CREATE INDEX `grn_history_timestamp_idx` ON `grn_history` (`timestamp`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_id_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `purchase_orders_location_id_idx` ON `purchase_orders` (`location_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_user_id_idx` ON `purchase_orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_status_timestamp_idx` ON `purchase_orders` (`supplier_id`,`status`,`timestamp`);--> statement-breakpoint
CREATE INDEX `purchase_order_documents_purchase_order_id_idx` ON `purchase_order_documents` (`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_documents_document_type_idx` ON `purchase_order_documents` (`document_type`);--> statement-breakpoint
CREATE INDEX `purchase_order_items_product_id_idx` ON `purchase_order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_logs_purchase_order_id_idx` ON `purchase_order_logs` (`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_logs_action_idx` ON `purchase_order_logs` (`action`);--> statement-breakpoint
CREATE INDEX `purchase_order_logs_timestamp_idx` ON `purchase_order_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `purchase_returns_status_idx` ON `purchase_returns` (`status`);--> statement-breakpoint
CREATE INDEX `purchase_return_items_purchase_return_id_idx` ON `purchase_return_items` (`purchase_return_id`);--> statement-breakpoint
CREATE INDEX `suppliers_phone_idx` ON `suppliers` (`phone`);--> statement-breakpoint
CREATE INDEX `suppliers_is_active_idx` ON `suppliers` (`is_active`);--> statement-breakpoint
CREATE INDEX `supplier_products_code_idx` ON `supplier_products` (`supplier_product_code`);--> statement-breakpoint
CREATE INDEX `supplier_products_is_preferred_idx` ON `supplier_products` (`is_preferred`);--> statement-breakpoint
CREATE INDEX `supplier_products_is_active_idx` ON `supplier_products` (`is_active`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_grn_id_idx` ON `supplier_invoices` (`grn_id`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_invoice_date_idx` ON `supplier_invoices` (`invoice_date`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_due_date_idx` ON `supplier_invoices` (`due_date`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_status_idx` ON `supplier_invoices` (`status`);--> statement-breakpoint
CREATE INDEX `supplier_payments_supplier_id_idx` ON `supplier_payments` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `supplier_payments_method_idx` ON `supplier_payments` (`method`);--> statement-breakpoint
CREATE INDEX `supplier_payments_reference_no_idx` ON `supplier_payments` (`reference_no`);--> statement-breakpoint
CREATE INDEX `supplier_payments_payment_date_idx` ON `supplier_payments` (`payment_date`);--> statement-breakpoint
CREATE INDEX `repair_documents_repair_job_id_idx` ON `repair_documents` (`repair_job_id`);--> statement-breakpoint
CREATE INDEX `repair_documents_document_type_idx` ON `repair_documents` (`document_type`);--> statement-breakpoint
CREATE INDEX `repair_history_repair_job_id_idx` ON `repair_history` (`repair_job_id`);--> statement-breakpoint
CREATE INDEX `repair_history_new_status_idx` ON `repair_history` (`new_status`);--> statement-breakpoint
CREATE INDEX `repair_history_timestamp_idx` ON `repair_history` (`timestamp`);--> statement-breakpoint
CREATE INDEX `repair_jobs_serial_imei_idx` ON `repair_jobs` (`serial_imei`);--> statement-breakpoint
CREATE INDEX `repair_jobs_status_idx` ON `repair_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `repair_jobs_timestamp_idx` ON `repair_jobs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `repair_labour_repair_job_id_idx` ON `repair_labour` (`repair_job_id`);--> statement-breakpoint
CREATE INDEX `repair_parts_repair_job_id_idx` ON `repair_parts` (`repair_job_id`);--> statement-breakpoint
CREATE INDEX `repair_payments_repair_job_id_idx` ON `repair_payments` (`repair_job_id`);--> statement-breakpoint
CREATE INDEX `repair_payments_method_idx` ON `repair_payments` (`method`);--> statement-breakpoint
CREATE INDEX `repair_payments_timestamp_idx` ON `repair_payments` (`timestamp`);--> statement-breakpoint
CREATE INDEX `locations_name_idx` ON `locations` (`name`);--> statement-breakpoint
CREATE INDEX `locations_type_idx` ON `locations` (`type`);--> statement-breakpoint
CREATE INDEX `locations_is_active_idx` ON `locations` (`is_active`);--> statement-breakpoint
CREATE INDEX `stock_product_id_idx` ON `stock` (`product_id`);--> statement-breakpoint
CREATE INDEX `stock_supplier_id_idx` ON `stock` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `stock_location_id_idx` ON `stock` (`location_id`);--> statement-breakpoint
CREATE INDEX `stock_status_idx` ON `stock` (`status`);--> statement-breakpoint
CREATE INDEX `stock_product_status_location_idx` ON `stock` (`product_id`,`status`,`location_id`);--> statement-breakpoint
CREATE INDEX `stock_adjustments_status_idx` ON `stock_adjustments` (`status`);--> statement-breakpoint
CREATE INDEX `stock_adjustment_items_stock_id_idx` ON `stock_adjustment_items` (`stock_id`);--> statement-breakpoint
CREATE INDEX `stock_logs_stock_id_idx` ON `stock_logs` (`stock_id`);--> statement-breakpoint
CREATE INDEX `stock_logs_action_idx` ON `stock_logs` (`action`);--> statement-breakpoint
CREATE INDEX `stock_logs_reference_idx` ON `stock_logs` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `stock_logs_timestamp_idx` ON `stock_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `stock_statuses_is_sellable_idx` ON `stock_statuses` (`is_sellable`);--> statement-breakpoint
CREATE INDEX `stock_transfers_status_idx` ON `stock_transfers` (`status`);--> statement-breakpoint
CREATE INDEX `permissions_module_idx` ON `permissions` (`module`);--> statement-breakpoint
CREATE INDEX `users_default_location_id_idx` ON `users` (`default_location_id`);--> statement-breakpoint
CREATE INDEX `users_is_active_idx` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_at_idx` ON `user_sessions` (`expires_at`);
