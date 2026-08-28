ALTER TABLE `permissions` ADD `priority` double DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `permissions` ADD `main_category` varchar(100) DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE `permissions` ADD `category` varchar(100) DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE `permissions` ADD `title` varchar(150) DEFAULT 'Permission' NOT NULL;--> statement-breakpoint
ALTER TABLE `permissions` ADD `is_system` boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `permissions`
SET `main_category` = CASE WHEN `module` = 'system' THEN 'System' ELSE `module` END,
    `category` = `module`,
    `title` = `key`
WHERE `title` = 'Permission';
