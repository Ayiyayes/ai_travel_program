CREATE TABLE `channelUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('institution_channel','individual_channel','sales') NOT NULL,
	`channelId` int,
	`salesId` int,
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`mustChangePassword` boolean NOT NULL DEFAULT true,
	`lastLoginTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channelUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `channelUsers_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelCode` varchar(20) NOT NULL,
	`channelName` varchar(100) NOT NULL,
	`channelType` enum('institution','individual') NOT NULL,
	`contactPerson` varchar(50) NOT NULL,
	`contactPhone` varchar(20),
	`cities` text,
	`scenicSpots` text,
	`status` enum('active','inactive','expired') NOT NULL DEFAULT 'active',
	`cooperationStartDate` timestamp NOT NULL,
	`cooperationDays` int NOT NULL DEFAULT 360,
	`cooperationEndDate` timestamp NOT NULL,
	`commissionRate` int NOT NULL DEFAULT 20,
	`institutionRetentionRate` int DEFAULT 40,
	`salesCommissionRate` int DEFAULT 60,
	`newUserPoints` int DEFAULT 10,
	`promotionActivity` text,
	`loginAccount` varchar(50),
	`loginPassword` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `channels_channelCode_unique` UNIQUE(`channelCode`),
	CONSTRAINT `channels_loginAccount_unique` UNIQUE(`loginAccount`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`pinyin` varchar(50) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `groupTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`displayName` varchar(20) NOT NULL,
	`photoType` enum('single','couple') NOT NULL DEFAULT 'single',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `groupTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `groupTypes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `imageCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`batchName` varchar(255),
	`batchId` varchar(50),
	`fileName` varchar(255) NOT NULL,
	`previewUrl` text,
	`s3Key` varchar(500),
	`city` varchar(50) NOT NULL,
	`spot` varchar(100) NOT NULL,
	`groupType` varchar(50) NOT NULL,
	`faceType` enum('wide','narrow','both') NOT NULL DEFAULT 'both',
	`price` int NOT NULL DEFAULT 0,
	`templateId` varchar(100),
	`prompt` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `imageCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNo` varchar(50) NOT NULL,
	`userId` int NOT NULL,
	`channelId` int,
	`salesId` int,
	`promotionCodeId` int,
	`orderType` enum('single_photo','batch_photo','membership') NOT NULL,
	`orderAmount` int NOT NULL,
	`pointsUsed` int NOT NULL DEFAULT 0,
	`commissionAmount` int NOT NULL DEFAULT 0,
	`orderStatus` enum('pending','paid','completed','failed') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(20),
	`paymentTime` timestamp,
	`thirdPartyOrderNo` varchar(100),
	`city` varchar(50),
	`scenicSpot` varchar(100),
	`faceType` varchar(20),
	`selfieUrl` text,
	`templateIds` text,
	`resultUrls` text,
	`photoCount` int NOT NULL DEFAULT 1,
	`errorCode` varchar(50),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNo_unique` UNIQUE(`orderNo`)
);
--> statement-breakpoint
CREATE TABLE `photoInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invitationCode` varchar(20) NOT NULL,
	`initiatorId` int NOT NULL,
	`partnerId` int,
	`templateId` int NOT NULL,
	`initiatorSelfieUrl` text NOT NULL,
	`partnerSelfieUrl` text,
	`status` enum('pending','accepted','completed','expired','cancelled') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `photoInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoInvitations_invitationCode_unique` UNIQUE(`invitationCode`)
);
--> statement-breakpoint
CREATE TABLE `pointsRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('earn','spend','refund','gift') NOT NULL,
	`amount` int NOT NULL,
	`balance` int NOT NULL,
	`description` text,
	`relatedOrderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pointsRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotionCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`salesId` int,
	`promoCode` varchar(50) NOT NULL,
	`city` varchar(50) NOT NULL,
	`scenicSpot` varchar(100) NOT NULL,
	`promotionLink` text NOT NULL,
	`qrCodeUrl` text,
	`wechatLink` text,
	`wechatQrCodeUrl` text,
	`douyinLink` text,
	`douyinQrCodeUrl` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`scanCount` int NOT NULL DEFAULT 0,
	`orderCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotionCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotionCodes_promoCode_unique` UNIQUE(`promoCode`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`salesCode` varchar(20) NOT NULL,
	`salesName` varchar(50) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`commissionRate` int NOT NULL DEFAULT 60,
	`city` varchar(50),
	`scenicSpot` varchar(100),
	`promoCode` varchar(50),
	`promotionLink` text,
	`assignedScenics` text,
	`loginAccount` varchar(50),
	`loginPassword` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_salesCode_unique` UNIQUE(`salesCode`),
	CONSTRAINT `sales_loginAccount_unique` UNIQUE(`loginAccount`)
);
--> statement-breakpoint
CREATE TABLE `salesPromotionCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salesId` int NOT NULL,
	`channelId` int NOT NULL,
	`city` varchar(50) NOT NULL,
	`scenicSpot` varchar(100) NOT NULL,
	`promoCode` varchar(50) NOT NULL,
	`wechatLink` text,
	`wechatQrCodeUrl` text,
	`douyinLink` text,
	`douyinQrCodeUrl` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`scanCount` int NOT NULL DEFAULT 0,
	`orderCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesPromotionCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `salesPromotionCodes_promoCode_unique` UNIQUE(`promoCode`)
);
--> statement-breakpoint
CREATE TABLE `shareConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageCode` varchar(20) NOT NULL,
	`pageName` varchar(50) NOT NULL,
	`title` varchar(100),
	`coverUrl` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shareConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `shareConfigs_pageCode_unique` UNIQUE(`pageCode`)
);
--> statement-breakpoint
CREATE TABLE `spots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`cityId` int NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(50) NOT NULL,
	`configValue` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemConfigs_configKey_unique` UNIQUE(`configKey`)
);
--> statement-breakpoint
CREATE TABLE `templateDrafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`batchId` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`imageUrl` text NOT NULL,
	`thumbnailUrl` text,
	`city` varchar(50),
	`scenicSpot` varchar(100),
	`groupType` varchar(50),
	`faceType` varchar(20),
	`price` varchar(20),
	`templateId` varchar(100),
	`aiDescription` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `templateDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`imageUrl` text NOT NULL,
	`thumbnailUrl` text,
	`city` varchar(50) NOT NULL,
	`scenicSpot` varchar(100) NOT NULL,
	`groupType` varchar(50) NOT NULL,
	`photoType` enum('single','couple') NOT NULL DEFAULT 'single',
	`faceType` enum('wide','narrow','both') NOT NULL DEFAULT 'both',
	`price` int NOT NULL DEFAULT 0,
	`isFree` boolean NOT NULL DEFAULT false,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`sortOrder` int NOT NULL DEFAULT 0,
	`templateGroupId` varchar(50),
	`hasMaskRegions` boolean NOT NULL DEFAULT false,
	`maskRegions` text,
	`maskedImageUrl` text,
	`regionCacheUrl` text,
	`prompt` text,
	`viewCount` int NOT NULL DEFAULT 0,
	`selectCount` int NOT NULL DEFAULT 0,
	`purchaseCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `templates_templateId_unique` UNIQUE(`templateId`)
);
--> statement-breakpoint
CREATE TABLE `userPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`photoId` varchar(50) NOT NULL,
	`userId` int NOT NULL,
	`orderId` int,
	`templateId` int NOT NULL,
	`selfieUrl` text NOT NULL,
	`selfie2Url` text,
	`resultUrl` text,
	`thumbnailUrl` text,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`errorCode` varchar(20),
	`errorMessage` text,
	`workflowRunId` varchar(100),
	`faceAnalysisId` varchar(100),
	`detectedFaceType` varchar(10),
	`detectedGender` varchar(10),
	`detectedUserType` varchar(20),
	`faceAnalysisResult` text,
	`photoType` enum('single','couple') NOT NULL DEFAULT 'single',
	`invitationId` int,
	`shareCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `userPhotos_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPhotos_photoId_unique` UNIQUE(`photoId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `points` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `initialFreeCredits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `hasUsedFreeCredits` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `channelId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `salesId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `promotionCodeId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `gender` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `userType` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `faceType` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `lastSelfieUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `lastSelfieTime` timestamp;