ALTER TABLE `stock_adjustments`
  ADD COLUMN `decision_note` varchar(512) NULL AFTER `reason`;
