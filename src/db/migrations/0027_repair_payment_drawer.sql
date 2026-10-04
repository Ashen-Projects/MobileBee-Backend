ALTER TABLE `pos_drawers`
  ADD COLUMN `counted_mobile_total` decimal(12,2) NULL AFTER `counted_bank_transfer_total`;
--> statement-breakpoint
ALTER TABLE `repair_payments`
  ADD COLUMN `drawer_id` int NULL AFTER `repair_job_id`;
--> statement-breakpoint
ALTER TABLE `repair_payments`
  ADD CONSTRAINT `repair_pay_drawer_fk`
  FOREIGN KEY (`drawer_id`) REFERENCES `pos_drawers`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `repair_payments_drawer_id_idx` ON `repair_payments` (`drawer_id`);
