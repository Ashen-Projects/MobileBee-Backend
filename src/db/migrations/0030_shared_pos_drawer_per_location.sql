ALTER TABLE `pos_drawers`
  ADD COLUMN `open_location_id` int
    GENERATED ALWAYS AS (CASE WHEN `status` = 'open' THEN `location_id` ELSE NULL END) STORED,
  ADD UNIQUE INDEX `pos_drawers_open_location_uq` (`open_location_id`);
