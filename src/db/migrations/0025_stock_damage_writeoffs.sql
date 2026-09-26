ALTER TABLE `stock_adjustments`
  ADD COLUMN `adjustment_type` varchar(32) NOT NULL DEFAULT 'general' AFTER `adjustment_no`;

CREATE INDEX `stock_adjustments_type_location_time_idx`
  ON `stock_adjustments` (`adjustment_type`, `location_id`, `timestamp`);

INSERT INTO `permissions` (`key`, `module`, `priority`, `main_category`, `category`, `title`, `description`, `is_system`)
VALUES
  ('stock.damage.view', 'stock', 100, 'Inventory', 'Stock', 'Damaged stock — View', 'View damaged-stock write-offs, their unit history, and recorded cost losses.', 1),
  ('stock.damage.create', 'stock', 100, 'Inventory', 'Stock', 'Damaged stock — Submit request', 'Scan available stock and submit damaged-unit requests for administrator approval.', 1)
ON DUPLICATE KEY UPDATE
  `module` = VALUES(`module`),
  `title` = VALUES(`title`),
  `description` = VALUES(`description`),
  `is_system` = VALUES(`is_system`);

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
INNER JOIN `permissions` ON `permissions`.`key` IN ('stock.damage.view', 'stock.damage.create')
WHERE `roles`.`name` = 'admin';
