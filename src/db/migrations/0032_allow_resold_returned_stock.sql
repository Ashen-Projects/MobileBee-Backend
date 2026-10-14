-- A unit may appear in multiple historical sales when a customer returns it
-- in sellable condition and it is later sold again. Current availability is
-- enforced by the stock status lock in the sale transaction.
--
-- The historical unique index is currently also used by the stock FK, so the
-- FK is temporarily recreated against a standard (non-unique) index.
ALTER TABLE `sale_item_stock`
  DROP FOREIGN KEY `sale_item_stock_stock_id_stock_id_fk`;
--> statement-breakpoint
ALTER TABLE `sale_item_stock`
  DROP INDEX `sale_item_stock_stock_id_uq`;
--> statement-breakpoint
ALTER TABLE `sale_item_stock`
  ADD INDEX `sale_item_stock_stock_id_idx` (`stock_id`);
--> statement-breakpoint
ALTER TABLE `sale_item_stock`
  ADD CONSTRAINT `sale_item_stock_stock_id_stock_id_fk`
  FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`)
  ON DELETE NO ACTION ON UPDATE NO ACTION;
