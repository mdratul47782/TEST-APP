CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('Admin','Store_Manager','QA_Inspector','Merchandiser') NOT NULL DEFAULT 'Store_Manager',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_name` varchar(200) NOT NULL,
	`contact_person` varchar(100),
	`phone` varchar(50),
	`email` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`material_code` varchar(50) NOT NULL,
	`material_name` varchar(200) NOT NULL,
	`category` enum('Fabric','Trim','Accessory','Webbing','Elastic','Zipper') NOT NULL,
	`supplier_id` int,
	`stock_quantity` int NOT NULL DEFAULT 0,
	`unit` varchar(20) NOT NULL DEFAULT 'pcs',
	`rack_location` varchar(100),
	`test_status` enum('Pending','Passed','Failed') NOT NULL DEFAULT 'Pending',
	`document_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_materials_material_code_unique` UNIQUE(`material_code`)
);
--> statement-breakpoint
CREATE TABLE `material_test_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`material_id` int NOT NULL,
	`tested_by` int,
	`test_result` varchar(20) NOT NULL,
	`remarks` text,
	`tested_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_test_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `test_materials` ADD CONSTRAINT `test_materials_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_test_logs` ADD CONSTRAINT `material_test_logs_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_test_logs` ADD CONSTRAINT `material_test_logs_tested_by_users_id_fk` FOREIGN KEY (`tested_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_materials_supplier` ON `test_materials` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_materials_status` ON `test_materials` (`test_status`);--> statement-breakpoint
CREATE INDEX `idx_materials_category` ON `test_materials` (`category`);--> statement-breakpoint
CREATE INDEX `idx_logs_material` ON `material_test_logs` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_logs_tested_by` ON `material_test_logs` (`tested_by`);