ALTER TABLE `groupTypes` MODIFY COLUMN `photoType` enum('single','group') NOT NULL DEFAULT 'single';--> statement-breakpoint
ALTER TABLE `templates` MODIFY COLUMN `photoType` enum('single','group') NOT NULL DEFAULT 'single';--> statement-breakpoint
ALTER TABLE `userPhotos` MODIFY COLUMN `photoType` enum('single','group') NOT NULL DEFAULT 'single';