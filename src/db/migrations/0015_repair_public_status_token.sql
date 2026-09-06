ALTER TABLE `repair_jobs` ADD `public_status_token` varchar(128);--> statement-breakpoint
UPDATE `repair_jobs` SET `public_status_token` = REPLACE(UUID(), '-', '') WHERE `id` > 0 AND `public_status_token` IS NULL;--> statement-breakpoint
ALTER TABLE `repair_jobs` MODIFY COLUMN `public_status_token` varchar(128) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `repair_jobs_public_status_token_uq` ON `repair_jobs` (`public_status_token`);
