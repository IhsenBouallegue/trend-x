CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`detection_run_id` text NOT NULL,
	`change_id` text NOT NULL,
	`title` text NOT NULL,
	`explanation` text NOT NULL,
	`change_type` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`detection_run_id`) REFERENCES `change_detection_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`change_id`) REFERENCES `detected_change`(`id`) ON UPDATE no action ON DELETE cascade
);
