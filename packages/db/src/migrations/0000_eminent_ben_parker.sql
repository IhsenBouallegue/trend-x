CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_fetched_tweet_id` text,
	`last_fetched_at` integer,
	`last_fetch_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_handle_unique` ON `account` (`handle`);--> statement-breakpoint
CREATE TABLE `config` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `config_key_unique` ON `config` (`key`);--> statement-breakpoint
CREATE TABLE `change_detection_run` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`fingerprint_id` text NOT NULL,
	`previous_fingerprint_id` text,
	`is_baseline` integer DEFAULT 0 NOT NULL,
	`change_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fingerprint_id`) REFERENCES `fingerprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `detected_change` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`type` text NOT NULL,
	`dimension` text NOT NULL,
	`explanation` text NOT NULL,
	`before_value` text,
	`after_value` text NOT NULL,
	`evidence` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `change_detection_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fingerprint` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`version` integer NOT NULL,
	`tweet_count` integer NOT NULL,
	`window_start` integer NOT NULL,
	`window_end` integer NOT NULL,
	`tweets_per_day` real NOT NULL,
	`max_silence_hours` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fingerprint_topic_mapping` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_id` text NOT NULL,
	`topic_registry_id` text NOT NULL,
	`cluster_centroid` text NOT NULL,
	`similarity` real NOT NULL,
	`proportion` real NOT NULL,
	`tweet_count` integer NOT NULL,
	`sentiment_positive` real NOT NULL,
	`sentiment_neutral` real NOT NULL,
	`sentiment_negative` real NOT NULL,
	`sample_tweet_ids` text,
	FOREIGN KEY (`fingerprint_id`) REFERENCES `fingerprint`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_registry_id`) REFERENCES `topic_registry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `topic` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_id` text NOT NULL,
	`label` text NOT NULL,
	`proportion` real NOT NULL,
	`tweet_count` integer NOT NULL,
	`centroid` text NOT NULL,
	`sentiment_positive` real NOT NULL,
	`sentiment_neutral` real NOT NULL,
	`sentiment_negative` real NOT NULL,
	`sample_tweet_ids` text,
	FOREIGN KEY (`fingerprint_id`) REFERENCES `fingerprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `topic_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`label` text NOT NULL,
	`canonical_centroid` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tweet` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`text` text NOT NULL,
	`tweet_created_at` integer NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`retweet_count` integer DEFAULT 0 NOT NULL,
	`reply_count` integer DEFAULT 0 NOT NULL,
	`raw_json` text,
	`fetched_at` integer NOT NULL,
	`is_retweet` integer DEFAULT 0 NOT NULL,
	`is_reply` integer DEFAULT 0 NOT NULL,
	`is_quote_tweet` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
