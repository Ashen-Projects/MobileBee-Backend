ALTER TABLE `product_images` ADD `cloudinary_public_id` varchar(512);--> statement-breakpoint
CREATE INDEX `product_images_cloudinary_public_id_idx` ON `product_images` (`cloudinary_public_id`);
