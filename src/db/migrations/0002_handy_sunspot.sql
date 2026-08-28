ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `firebase_uid` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_firebase_uid_uq` UNIQUE(`firebase_uid`);