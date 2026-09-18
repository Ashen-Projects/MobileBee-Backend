ALTER TABLE `grn_documents`
  ADD `cloudinary_public_id` varchar(512) AFTER `file_url`;
--> statement-breakpoint
CREATE INDEX `grn_documents_cloudinary_public_id_idx` ON `grn_documents` (`cloudinary_public_id`);
