ALTER TABLE `suppliers`
  ADD `preferred_payment_method` enum('cash','bankTransfer','cheque','card') NOT NULL DEFAULT 'bankTransfer' AFTER `payment_term_days`;
--> statement-breakpoint
CREATE INDEX `suppliers_preferred_payment_method_idx` ON `suppliers` (`preferred_payment_method`);
