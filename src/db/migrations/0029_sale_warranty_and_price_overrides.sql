ALTER TABLE `sales`
  ADD COLUMN `price_override_reason` varchar(500) NULL AFTER `discount_amount`;
--> statement-breakpoint
ALTER TABLE `sale_items`
  ADD COLUMN `warranty_type` varchar(32) NULL AFTER `product_id`,
  ADD COLUMN `warranty_period_months` int NULL AFTER `warranty_type`;
