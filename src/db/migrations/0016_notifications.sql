CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(180) NOT NULL,
  `message` text NOT NULL,
  `module` varchar(80) NOT NULL DEFAULT 'general',
  `severity` varchar(30) NOT NULL DEFAULT 'info',
  `entity_type` varchar(80),
  `entity_id` int,
  `location_id` int,
  `target_permission` varchar(150),
  `target_user_id` int,
  `created_by` int,
  `timestamp` bigint unsigned NOT NULL,
  `expires_at` bigint unsigned,
  PRIMARY KEY (`id`),
  KEY `notifications_module_idx` (`module`),
  KEY `notifications_location_idx` (`location_id`),
  KEY `notifications_target_user_idx` (`target_user_id`),
  KEY `notifications_timestamp_idx` (`timestamp`),
  CONSTRAINT `notifications_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `notifications_target_user_id_users_id_fk` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `notifications_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `notification_reads` (
  `notification_id` int NOT NULL,
  `user_id` int NOT NULL,
  `read_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`notification_id`, `user_id`),
  CONSTRAINT `notification_reads_notification_id_notifications_id_fk` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`),
  CONSTRAINT `notification_reads_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);
