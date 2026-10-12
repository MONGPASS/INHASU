CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_id` text,
	`email` text,
	`name` text,
	`role` text DEFAULT 'user',
	`avatar_url` text,
	`password_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`duration` text NOT NULL,
	`price` integer NOT NULL,
	`original_price` integer,
	`main_images` text NOT NULL,
	`gallery_images` text NOT NULL,
	`detail_images` text NOT NULL,
	`itinerary_images` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_featured` integer DEFAULT false,
	`is_popular` integer DEFAULT false,
	`tags` text NOT NULL,
	`included` text NOT NULL,
	`excluded` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`view_count` integer DEFAULT 0,
	`booking_count` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'tour',
	`product_name` text,
	`customer_name` text,
	`customer_email` text,
	`customer_phone` text,
	`travelers` integer DEFAULT 1,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'pending_payment',
	`total_price` real DEFAULT 0,
	`deposit_amount` real DEFAULT 0,
	`balance_amount` real DEFAULT 0,
	`payment_method` text,
	`daily_accommodations` text DEFAULT '[]',
	`notes` text,
	`history` text DEFAULT '[]',
	`user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`destination` text,
	`headcount` text,
	`period` text,
	`budget` text,
	`travel_types` text,
	`accommodations` text,
	`vehicle` text,
	`additional_request` text,
	`attachment_url` text,
	`status` text DEFAULT 'pending',
	`admin_note` text,
	`estimate_url` text,
	`confirmed_start_date` text,
	`confirmed_end_date` text,
	`confirmed_price` integer,
	`deposit` integer,
	`deposit_status` text DEFAULT 'unpaid',
	`balance_status` text DEFAULT 'unpaid',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
