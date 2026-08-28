ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_role_id_roles_id_fk`;--> statement-breakpoint
ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_location_id_locations_id_fk`;--> statement-breakpoint
ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_assigned_by_users_id_fk`;--> statement-breakpoint
ALTER TABLE `user_roles` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `user_roles` MODIFY COLUMN `location_id` int NULL;--> statement-breakpoint
ALTER TABLE `user_roles` ADD PRIMARY KEY(`user_id`,`role_id`);--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
