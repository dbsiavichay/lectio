CREATE TABLE `answer_checks` (
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`code` text NOT NULL,
	`revealed_at` integer NOT NULL,
	`grade` text,
	PRIMARY KEY(`user_id`, `book_slug`, `code`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `books` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_hash` text NOT NULL,
	`content` text NOT NULL,
	`imported_at` integer NOT NULL,
	`imported_by` text,
	FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`unit_id` text NOT NULL,
	`teaching` text DEFAULT '' NOT NULL,
	`behavior` text DEFAULT '' NOT NULL,
	`action` text DEFAULT '' NOT NULL,
	`situation` text DEFAULT '' NOT NULL,
	`due_on` text,
	`measure` text DEFAULT '' NOT NULL,
	`learned` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`observed` text DEFAULT '' NOT NULL,
	`keep_as_habit` integer DEFAULT false NOT NULL,
	`checked_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commitments_unit_idx` ON `commitments` (`user_id`,`book_slug`,`unit_id`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`started_on` text NOT NULL,
	`study_days` text NOT NULL,
	`rest_days` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_slug`) REFERENCES `books`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_user_book_idx` ON `enrollments` (`user_id`,`book_slug`);--> statement-breakpoint
CREATE TABLE `field_values` (
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `book_slug`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `review_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`kind` text NOT NULL,
	`ref` integer NOT NULL,
	`due_on` text NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_tasks_unique_idx` ON `review_tasks` (`user_id`,`book_slug`,`kind`,`ref`);--> statement-breakpoint
CREATE INDEX `review_tasks_due_idx` ON `review_tasks` (`user_id`,`due_on`);--> statement-breakpoint
CREATE TABLE `section_pages` (
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`section_id` text NOT NULL,
	`page` integer NOT NULL,
	PRIMARY KEY(`user_id`, `book_slug`, `section_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `unit_progress` (
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`unit_id` text NOT NULL,
	`status` text NOT NULL,
	`current_step` integer DEFAULT 1 NOT NULL,
	`rating` integer,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`completed_on` text,
	PRIMARY KEY(`user_id`, `book_slug`, `unit_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`color` text DEFAULT 'teal' NOT NULL,
	`timezone` text DEFAULT 'America/Guayaquil' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);