ALTER TABLE `repair_documents` MODIFY COLUMN `document_type` enum('intakePhoto','inspectionPhoto','estimate','approval','repairPhoto','deliveryProof','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `repair_documents` ADD `cloudinary_public_id` varchar(512);--> statement-breakpoint
CREATE INDEX `repair_documents_cloudinary_public_id_idx` ON `repair_documents` (`cloudinary_public_id`);
