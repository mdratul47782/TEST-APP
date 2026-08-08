CREATE TABLE `buyers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyer_code` varchar(20) NOT NULL,
	`buyer_name` varchar(200) NOT NULL,
	`contact_person` varchar(100),
	`email` varchar(255),
	`phone` varchar(50),
	`address` text,
	`payment_terms` varchar(100),
	`shipping_terms` varchar(100),
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `buyers_id` PRIMARY KEY(`id`),
	CONSTRAINT `buyers_buyer_code_unique` UNIQUE(`buyer_code`)
);
--> statement-breakpoint
CREATE TABLE `styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style_number` varchar(50) NOT NULL,
	`product_name` varchar(200) NOT NULL,
	`category` varchar(100),
	`season` varchar(50),
	`buyer_id` int,
	`smv` decimal(8,3),
	`size_range` json,
	`color_range` json,
	`production_route` text,
	`status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `styles_style_number_unique` UNIQUE(`style_number`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouse_code` varchar(20) NOT NULL,
	`warehouse_name` varchar(100) NOT NULL,
	`location` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouses_warehouse_code_unique` UNIQUE(`warehouse_code`)
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_no` varchar(50) NOT NULL,
	`buyer_id` int NOT NULL,
	`order_date` date NOT NULL,
	`delivery_date` date NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`order_status` enum('Draft','Booked','Confirmed','In_Production','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
	`priority` enum('Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
	`remarks` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_orders_order_no_unique` UNIQUE(`order_no`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`style_id` int NOT NULL,
	`color` varchar(50) NOT NULL,
	`quantity` int NOT NULL,
	`size_breakdown` json,
	`unit_price` decimal(12,2),
	`bom_version_id` int,
	`line_status` enum('Booked','In_Production','Completed','Cancelled') NOT NULL DEFAULT 'Booked',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_amendments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`field` varchar(50) NOT NULL,
	`old_value` text,
	`new_value` text,
	`amended_by` int,
	`amended_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_amendments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bom_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style_id` int NOT NULL,
	`version_no` int NOT NULL,
	`status` enum('Draft','Active','Superseded') NOT NULL DEFAULT 'Draft',
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bom_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_bom_style_version` UNIQUE(`style_id`,`version_no`)
);
--> statement-breakpoint
CREATE TABLE `bom_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bom_version_id` int NOT NULL,
	`material_id` int,
	`material_name` varchar(200),
	`category` enum('Fabric','Trim','Accessory','Webbing','Elastic','Zipper'),
	`unit` varchar(20),
	`consumption` decimal(12,4) NOT NULL,
	`wastage_pct` decimal(5,2) NOT NULL DEFAULT '0',
	`color_dependent` boolean NOT NULL DEFAULT false,
	`size_dependent` boolean NOT NULL DEFAULT false,
	`preferred_supplier_id` int,
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bom_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`material_id` int NOT NULL,
	`bom_version_id` int,
	`gross_qty` decimal(14,3) NOT NULL,
	`wastage_qty` decimal(14,3) NOT NULL DEFAULT '0',
	`net_qty` decimal(14,3) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_requirements_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_req_order_material` UNIQUE(`order_id`,`material_id`)
);
--> statement-breakpoint
CREATE TABLE `material_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`material_id` int NOT NULL,
	`qty` decimal(14,3) NOT NULL,
	`status` enum('Active','Released','Cancelled') NOT NULL DEFAULT 'Active',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requisitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pr_no` varchar(30) NOT NULL,
	`order_id` int,
	`status` enum('Draft','Pending_Approval','Approved','Converted','Rejected') NOT NULL DEFAULT 'Draft',
	`required_date` date,
	`remarks` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_requisitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_requisitions_pr_no_unique` UNIQUE(`pr_no`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requisition_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pr_id` int NOT NULL,
	`material_id` int NOT NULL,
	`qty` decimal(14,3) NOT NULL,
	`reason` varchar(200),
	`required_date` date,
	CONSTRAINT `purchase_requisition_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`material_id` int NOT NULL,
	`moq` decimal(14,3),
	`unit_price` decimal(14,4),
	`lead_time_days` int,
	`is_preferred` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `supplier_materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_supplier_material` UNIQUE(`supplier_id`,`material_id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`material_id` int NOT NULL,
	`unit_price` decimal(14,4) NOT NULL,
	`price_date` date NOT NULL,
	`remarks` varchar(200),
	CONSTRAINT `supplier_price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`po_no` varchar(30) NOT NULL,
	`supplier_id` int NOT NULL,
	`pr_id` int,
	`order_date` date NOT NULL,
	`delivery_date` date,
	`status` enum('Draft','Approved','Partially_Received','Received','Cancelled') NOT NULL DEFAULT 'Draft',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`remarks` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_orders_po_no_unique` UNIQUE(`po_no`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`po_id` int NOT NULL,
	`material_id` int NOT NULL,
	`qty` decimal(14,3) NOT NULL,
	`unit_price` decimal(14,4),
	`received_qty` decimal(14,3) NOT NULL DEFAULT '0',
	`cancelled_qty` decimal(14,3) NOT NULL DEFAULT '0',
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grn_no` varchar(30) NOT NULL,
	`po_id` int,
	`supplier_id` int,
	`received_date` date NOT NULL,
	`invoice_no` varchar(50),
	`challan_no` varchar(50),
	`warehouse_id` int,
	`status` enum('Pending_QC','QC_Passed','QC_Failed','Received') NOT NULL DEFAULT 'Pending_QC',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goods_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `goods_receipts_grn_no_unique` UNIQUE(`grn_no`)
);
--> statement-breakpoint
CREATE TABLE `goods_receipt_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grn_id` int NOT NULL,
	`po_item_id` int,
	`material_id` int NOT NULL,
	`received_qty` decimal(14,3) NOT NULL,
	`accepted_qty` decimal(14,3) NOT NULL,
	`rejected_qty` decimal(14,3) NOT NULL DEFAULT '0',
	`batch` varchar(50),
	`lot` varchar(50),
	`remarks` text,
	CONSTRAINT `goods_receipt_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fabric_rolls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`material_id` int NOT NULL,
	`grn_item_id` int,
	`roll_no` varchar(50) NOT NULL,
	`length` decimal(10,2) NOT NULL,
	`width` decimal(6,2),
	`shade` varchar(50),
	`batch` varchar(50),
	`lot` varchar(50),
	`gsm` int,
	`remaining_length` decimal(10,2) NOT NULL,
	`status` enum('In_Stock','Partial','Finished') NOT NULL DEFAULT 'In_Stock',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fabric_rolls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`material_id` int NOT NULL,
	`transaction_type` enum('Opening','GRN','Issue','Adjustment_In','Adjustment_Out','Transfer_In','Transfer_Out','Return_To_Supplier') NOT NULL,
	`qty` decimal(14,3) NOT NULL,
	`balance_after` decimal(14,3) NOT NULL,
	`warehouse_id` int,
	`reference_type` varchar(30),
	`reference_id` int,
	`remarks` varchar(255),
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adjustment_no` varchar(30) NOT NULL,
	`material_id` int NOT NULL,
	`qty` decimal(14,3) NOT NULL,
	`reason` varchar(200) NOT NULL,
	`status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
	`created_by` int,
	`approved_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_adjustments_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_adjustments_adjustment_no_unique` UNIQUE(`adjustment_no`)
);
--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`production_order_no` varchar(30) NOT NULL,
	`sales_order_line_id` int NOT NULL,
	`style_id` int NOT NULL,
	`qty` int NOT NULL,
	`status` enum('Planned','Ready_For_Cutting','In_Cutting','In_Sewing','In_Finishing','Completed','Cancelled') NOT NULL DEFAULT 'Planned',
	`line` varchar(30),
	`planned_start` date,
	`planned_end` date,
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_orders_production_order_no_unique` UNIQUE(`production_order_no`)
);
--> statement-breakpoint
CREATE TABLE `material_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issue_no` varchar(30) NOT NULL,
	`production_order_id` int,
	`warehouse_id` int,
	`issued_to` varchar(100),
	`status` enum('Requested','Approved','Issued','Partial','Rejected') NOT NULL DEFAULT 'Requested',
	`issue_date` date,
	`remarks` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_issues_id` PRIMARY KEY(`id`),
	CONSTRAINT `material_issues_issue_no_unique` UNIQUE(`issue_no`)
);
--> statement-breakpoint
CREATE TABLE `material_issue_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issue_id` int NOT NULL,
	`material_id` int NOT NULL,
	`requested_qty` decimal(14,3) NOT NULL,
	`issued_qty` decimal(14,3) NOT NULL DEFAULT '0',
	`unit` varchar(20),
	CONSTRAINT `material_issue_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cutting_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cutting_plan_no` varchar(30) NOT NULL,
	`production_order_id` int NOT NULL,
	`marker_no` varchar(50),
	`lay_no` varchar(50),
	`cut_qty` int,
	`status` enum('Planned','In_Progress','Completed') NOT NULL DEFAULT 'Planned',
	`planned_date` date,
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cutting_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `cutting_plans_cutting_plan_no_unique` UNIQUE(`cutting_plan_no`)
);
--> statement-breakpoint
CREATE TABLE `cutting_plan_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cutting_plan_id` int NOT NULL,
	`material_id` int NOT NULL,
	`planned_consumption` decimal(14,3) NOT NULL,
	`actual_consumption` decimal(14,3),
	`wastage_qty` decimal(14,3),
	`shortage_qty` decimal(14,3) NOT NULL DEFAULT '0',
	`excess_qty` decimal(14,3) NOT NULL DEFAULT '0',
	CONSTRAINT `cutting_plan_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cutting_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cutting_plan_id` int NOT NULL,
	`bundle_no` varchar(50) NOT NULL,
	`size` varchar(20),
	`color` varchar(50),
	`panel_count` int,
	`qty` int NOT NULL,
	CONSTRAINT `cutting_bundles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_output` (
	`id` int AUTO_INCREMENT NOT NULL,
	`production_order_id` int NOT NULL,
	`stage` enum('Sewing_Input','Sewing_Output','Finishing_Input','Finishing_Output') NOT NULL,
	`qty` int NOT NULL,
	`rejection_qty` int NOT NULL DEFAULT 0,
	`operator_id` int,
	`remarks` varchar(200),
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_output_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quality_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`check_no` varchar(30) NOT NULL,
	`reference_type` enum('Cutting','Sewing_Inline','End_Line','Finishing','Final') NOT NULL,
	`reference_id` int,
	`production_order_id` int,
	`checked_by` int,
	`result` enum('Passed','Failed','Rework') NOT NULL,
	`defect_code` varchar(50),
	`defect_qty` int NOT NULL DEFAULT 0,
	`remarks` text,
	`checked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `quality_checks_check_no_unique` UNIQUE(`check_no`)
);
--> statement-breakpoint
CREATE TABLE `finished_goods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fg_no` varchar(30) NOT NULL,
	`production_order_id` int,
	`sales_order_line_id` int,
	`style_id` int,
	`color` varchar(50),
	`size` varchar(20),
	`qty` int NOT NULL,
	`carton_no` varchar(50),
	`status` enum('In_Stock','Packed','Shipped') NOT NULL DEFAULT 'In_Stock',
	`warehouse_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finished_goods_id` PRIMARY KEY(`id`),
	CONSTRAINT `finished_goods_fg_no_unique` UNIQUE(`fg_no`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipment_no` varchar(30) NOT NULL,
	`sales_order_id` int,
	`buyer_id` int,
	`destination` varchar(200),
	`shipment_date` date,
	`status` enum('Planned','Partially_Shipped','Shipped','Completed') NOT NULL DEFAULT 'Planned',
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipments_shipment_no_unique` UNIQUE(`shipment_no`)
);
--> statement-breakpoint
CREATE TABLE `shipment_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipment_id` int NOT NULL,
	`sales_order_line_id` int,
	`qty` int NOT NULL,
	`cartons` int NOT NULL DEFAULT 0,
	`size_breakdown` json,
	CONSTRAINT `shipment_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`doc_type` varchar(20) NOT NULL,
	`last_no` int NOT NULL DEFAULT 0,
	CONSTRAINT `document_sequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_sequences_doc_type_unique` UNIQUE(`doc_type`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('Admin','Store_Manager','QA_Inspector','Merchandiser','Production_Manager','Procurement') NOT NULL DEFAULT 'Store_Manager';--> statement-breakpoint
ALTER TABLE `test_materials` MODIFY COLUMN `stock_quantity` decimal(12,3) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `suppliers` ADD `supplier_code` varchar(20);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `address` text;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `payment_terms` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `shipping_terms` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `rating` int;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `test_materials` ADD `safety_stock` decimal(12,3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `test_materials` ADD `warehouse_id` int;--> statement-breakpoint
ALTER TABLE `styles` ADD CONSTRAINT `styles_buyer_id_buyers_id_fk` FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_buyer_id_buyers_id_fk` FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD CONSTRAINT `sales_order_lines_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD CONSTRAINT `sales_order_lines_style_id_styles_id_fk` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD CONSTRAINT `sales_order_lines_bom_version_id_bom_versions_id_fk` FOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_amendments` ADD CONSTRAINT `order_amendments_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_amendments` ADD CONSTRAINT `order_amendments_amended_by_users_id_fk` FOREIGN KEY (`amended_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_versions` ADD CONSTRAINT `bom_versions_style_id_styles_id_fk` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_bom_version_id_bom_versions_id_fk` FOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_preferred_supplier_id_suppliers_id_fk` FOREIGN KEY (`preferred_supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_requirements` ADD CONSTRAINT `material_requirements_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_requirements` ADD CONSTRAINT `material_requirements_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_requirements` ADD CONSTRAINT `material_requirements_bom_version_id_bom_versions_id_fk` FOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_reservations` ADD CONSTRAINT `material_reservations_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_reservations` ADD CONSTRAINT `material_reservations_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_reservations` ADD CONSTRAINT `material_reservations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requisitions` ADD CONSTRAINT `purchase_requisitions_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requisitions` ADD CONSTRAINT `purchase_requisitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requisition_items` ADD CONSTRAINT `purchase_requisition_items_pr_id_purchase_requisitions_id_fk` FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requisition_items` ADD CONSTRAINT `purchase_requisition_items_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_materials` ADD CONSTRAINT `supplier_materials_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_materials` ADD CONSTRAINT `supplier_materials_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_price_history` ADD CONSTRAINT `supplier_price_history_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_price_history` ADD CONSTRAINT `supplier_price_history_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_pr_id_purchase_requisitions_id_fk` FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_po_id_purchase_orders_id_fk` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_po_id_purchase_orders_id_fk` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_grn_id_goods_receipts_id_fk` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_po_item_id_purchase_order_items_id_fk` FOREIGN KEY (`po_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fabric_rolls` ADD CONSTRAINT `fabric_rolls_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fabric_rolls` ADD CONSTRAINT `fabric_rolls_grn_item_id_goods_receipt_items_id_fk` FOREIGN KEY (`grn_item_id`) REFERENCES `goods_receipt_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_sales_order_line_id_sales_order_lines_id_fk` FOREIGN KEY (`sales_order_line_id`) REFERENCES `sales_order_lines`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_style_id_styles_id_fk` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_issues` ADD CONSTRAINT `material_issues_production_order_id_production_orders_id_fk` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_issues` ADD CONSTRAINT `material_issues_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_issues` ADD CONSTRAINT `material_issues_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_issue_items` ADD CONSTRAINT `material_issue_items_issue_id_material_issues_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `material_issues`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_issue_items` ADD CONSTRAINT `material_issue_items_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cutting_plans` ADD CONSTRAINT `cutting_plans_production_order_id_production_orders_id_fk` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cutting_plan_items` ADD CONSTRAINT `cutting_plan_items_cutting_plan_id_cutting_plans_id_fk` FOREIGN KEY (`cutting_plan_id`) REFERENCES `cutting_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cutting_plan_items` ADD CONSTRAINT `cutting_plan_items_material_id_test_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `test_materials`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cutting_bundles` ADD CONSTRAINT `cutting_bundles_cutting_plan_id_cutting_plans_id_fk` FOREIGN KEY (`cutting_plan_id`) REFERENCES `cutting_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_output` ADD CONSTRAINT `production_output_production_order_id_production_orders_id_fk` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_output` ADD CONSTRAINT `production_output_operator_id_users_id_fk` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quality_checks` ADD CONSTRAINT `quality_checks_production_order_id_production_orders_id_fk` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quality_checks` ADD CONSTRAINT `quality_checks_checked_by_users_id_fk` FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finished_goods` ADD CONSTRAINT `finished_goods_production_order_id_production_orders_id_fk` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finished_goods` ADD CONSTRAINT `finished_goods_sales_order_line_id_sales_order_lines_id_fk` FOREIGN KEY (`sales_order_line_id`) REFERENCES `sales_order_lines`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finished_goods` ADD CONSTRAINT `finished_goods_style_id_styles_id_fk` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finished_goods` ADD CONSTRAINT `finished_goods_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_sales_order_id_sales_orders_id_fk` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_buyer_id_buyers_id_fk` FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_items` ADD CONSTRAINT `shipment_items_shipment_id_shipments_id_fk` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_items` ADD CONSTRAINT `shipment_items_sales_order_line_id_sales_order_lines_id_fk` FOREIGN KEY (`sales_order_line_id`) REFERENCES `sales_order_lines`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_buyers_name` ON `buyers` (`buyer_name`);--> statement-breakpoint
CREATE INDEX `idx_styles_buyer` ON `styles` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `idx_styles_season` ON `styles` (`season`);--> statement-breakpoint
CREATE INDEX `idx_orders_buyer` ON `sales_orders` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_delivery` ON `sales_orders` (`delivery_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `sales_orders` (`order_status`);--> statement-breakpoint
CREATE INDEX `idx_order_lines_order` ON `sales_order_lines` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_order_lines_style` ON `sales_order_lines` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_amendments_order` ON `order_amendments` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_bom_style` ON `bom_versions` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_bom_items_version` ON `bom_items` (`bom_version_id`);--> statement-breakpoint
CREATE INDEX `idx_req_material` ON `material_requirements` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_res_order` ON `material_reservations` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_res_material` ON `material_reservations` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_res_status` ON `material_reservations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pr_order` ON `purchase_requisitions` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_pr_status` ON `purchase_requisitions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pr_items_pr` ON `purchase_requisition_items` (`pr_id`);--> statement-breakpoint
CREATE INDEX `idx_sm_material` ON `supplier_materials` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_ph_supplier_material` ON `supplier_price_history` (`supplier_id`,`material_id`);--> statement-breakpoint
CREATE INDEX `idx_po_supplier` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_po_status` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_po_pr` ON `purchase_orders` (`pr_id`);--> statement-breakpoint
CREATE INDEX `idx_po_items_po` ON `purchase_order_items` (`po_id`);--> statement-breakpoint
CREATE INDEX `idx_grn_po` ON `goods_receipts` (`po_id`);--> statement-breakpoint
CREATE INDEX `idx_grn_status` ON `goods_receipts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_grn_items_grn` ON `goods_receipt_items` (`grn_id`);--> statement-breakpoint
CREATE INDEX `idx_rolls_material` ON `fabric_rolls` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_ledger_material` ON `stock_transactions` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_ledger_ref` ON `stock_transactions` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `idx_adj_material` ON `stock_adjustments` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_po_line` ON `production_orders` (`sales_order_line_id`);--> statement-breakpoint
CREATE INDEX `idx_po_status` ON `production_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_mi_status` ON `material_issues` (`status`);--> statement-breakpoint
CREATE INDEX `idx_mi_prod` ON `material_issues` (`production_order_id`);--> statement-breakpoint
CREATE INDEX `idx_mii_issue` ON `material_issue_items` (`issue_id`);--> statement-breakpoint
CREATE INDEX `idx_cp_prod` ON `cutting_plans` (`production_order_id`);--> statement-breakpoint
CREATE INDEX `idx_cpi_plan` ON `cutting_plan_items` (`cutting_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_cb_plan` ON `cutting_bundles` (`cutting_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_output_prod` ON `production_output` (`production_order_id`);--> statement-breakpoint
CREATE INDEX `idx_qc_prod` ON `quality_checks` (`production_order_id`);--> statement-breakpoint
CREATE INDEX `idx_fg_prod` ON `finished_goods` (`production_order_id`);--> statement-breakpoint
CREATE INDEX `idx_fg_status` ON `finished_goods` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ship_order` ON `shipments` (`sales_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ship_status` ON `shipments` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ship_items_ship` ON `shipment_items` (`shipment_id`);--> statement-breakpoint
ALTER TABLE `test_materials` ADD CONSTRAINT `test_materials_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_suppliers_name` ON `suppliers` (`supplier_name`);--> statement-breakpoint
CREATE INDEX `idx_materials_warehouse` ON `test_materials` (`warehouse_id`);