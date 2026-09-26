ALTER TABLE `products`
  ADD `warranty_type` varchar(32) AFTER `mrp_price`,
  ADD `warranty_period_months` int NOT NULL DEFAULT 0 AFTER `warranty_type`;
