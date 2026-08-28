CREATE TABLE `product_category_required_attributes` (
	`attribute_id` int NOT NULL,
	`category_id` int NOT NULL,
	CONSTRAINT `product_category_required_attributes_category_id_attribute_id_pk` PRIMARY KEY(`category_id`,`attribute_id`)
);
--> statement-breakpoint
ALTER TABLE `product_attributes` ADD `description` varchar(1024);--> statement-breakpoint
ALTER TABLE `product_attributes` ADD `pre_unit` varchar(50);--> statement-breakpoint
ALTER TABLE `product_attributes` ADD `post_unit` varchar(50);--> statement-breakpoint
ALTER TABLE `product_attributes` ADD `is_effect_on_images` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product_attributes` ADD `is_effect_on_pricing` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product_attributes` ADD `is_effect_on_description` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product_attribute_options` ADD `description` varchar(1024);--> statement-breakpoint
ALTER TABLE `product_attribute_options` ADD `icon_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `product_categories` ADD `description` varchar(1024);--> statement-breakpoint
ALTER TABLE `product_categories` ADD `icon_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `product_categories` ADD `logo_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `product_categories` ADD `seo_id` int;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `is_available_on_web` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product_category_required_attributes` ADD CONSTRAINT `pcra_category_fk` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_category_required_attributes` ADD CONSTRAINT `pcra_attribute_fk` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_seo_id_seo_seo_id_fk` FOREIGN KEY (`seo_id`) REFERENCES `seo`(`seo_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_categories_seo_id_idx` ON `product_categories` (`seo_id`);