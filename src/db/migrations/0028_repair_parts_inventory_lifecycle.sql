ALTER TABLE `repair_parts`
  ADD COLUMN `status` enum('reserved','consumed','released') NOT NULL DEFAULT 'reserved' AFTER `unit_price`,
  ADD COLUMN `consumed_at` bigint unsigned NULL AFTER `status`,
  ADD COLUMN `released_at` bigint unsigned NULL AFTER `consumed_at`;
--> statement-breakpoint
CREATE INDEX `repair_parts_repair_status_idx` ON `repair_parts` (`repair_job_id`,`status`);
