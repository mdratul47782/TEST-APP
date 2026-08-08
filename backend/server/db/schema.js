/**
 * Drizzle ORM schema definitions for the Garments Factory ERP.
 *
 * Domain layers:
 *   Master      -> users, buyers, styles, suppliers, warehouses, test_materials
 *   Merchandise -> sales_orders, sales_order_lines, order_amendments
 *   BOM         -> bom_versions, bom_items
 *   Planning    -> material_requirements, material_reservations,
 *                  purchase_requisitions, purchase_requisition_items
 *   Procurement -> supplier_materials, supplier_price_history, purchase_orders,
 *                  purchase_order_items, goods_receipts, goods_receipt_items,
 *                  fabric_rolls
 *   Inventory   -> stock_transactions (ledger), stock_adjustments
 *   Production  -> production_orders, material_issues, material_issue_items,
 *                  cutting_plans, cutting_plan_items, cutting_bundles,
 *                  production_output
 *   Quality     -> quality_checks, material_test_logs
 *   Shipping    -> finished_goods, shipments, shipment_items
 *   Support     -> document_sequences
 */
const {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  datetime,
  date,
  decimal,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} = require('drizzle-orm/mysql-core');

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

const ROLES = [
  'Admin',
  'Store_Manager',
  'QA_Inspector',
  'Merchandiser',
  'Production_Manager',
  'Procurement',
];

const CATEGORIES = ['Fabric', 'Trim', 'Accessory', 'Webbing', 'Elastic', 'Zipper'];
const TEST_STATUSES = ['Pending', 'Passed', 'Failed'];
const MATERIAL_UNITS = ['pcs', 'm', 'yd', 'kg', 'roll', 'set', 'dozen', 'pair', 'gm', 'cm'];

const ORDER_STATUSES = ['Draft', 'Booked', 'Confirmed', 'In_Production', 'Completed', 'Cancelled'];
const LINE_STATUSES = ['Booked', 'In_Production', 'Completed', 'Cancelled'];

const BOM_STATUSES = ['Draft', 'Active', 'Superseded'];

const RESERVATION_STATUSES = ['Active', 'Released', 'Cancelled'];
const PR_STATUSES = ['Draft', 'Pending_Approval', 'Approved', 'Converted', 'Rejected'];
const PO_STATUSES = ['Draft', 'Approved', 'Partially_Received', 'Received', 'Cancelled'];

const GRN_STATUSES = ['Pending_QC', 'QC_Passed', 'QC_Failed', 'Received'];
const ADJUSTMENT_STATUSES = ['Pending', 'Approved', 'Rejected'];

const PRODUCTION_STATUSES = [
  'Planned',
  'Ready_For_Cutting',
  'In_Cutting',
  'In_Sewing',
  'In_Finishing',
  'Completed',
  'Cancelled',
];

const OUTPUT_STAGES = ['Sewing_Input', 'Sewing_Output', 'Finishing_Input', 'Finishing_Output'];

const QC_TYPES = ['Cutting', 'Sewing_Inline', 'End_Line', 'Finishing', 'Final'];
const QC_RESULTS = ['Passed', 'Failed', 'Rework'];

const FG_STATUSES = ['In_Stock', 'Packed', 'Shipped'];
const SHIPMENT_STATUSES = ['Planned', 'Partially_Shipped', 'Shipped', 'Completed'];

const ISSUE_STATUSES = ['Requested', 'Approved', 'Issued', 'Partial', 'Rejected'];

const TRANSACTION_TYPES = [
  'Opening',
  'GRN',
  'Issue',
  'Adjustment_In',
  'Adjustment_Out',
  'Transfer_In',
  'Transfer_Out',
  'Return_To_Supplier',
];

/* ------------------------------------------------------------------ */
/* users                                                               */
/* ------------------------------------------------------------------ */

const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: mysqlEnum('role', ROLES).notNull().default('Store_Manager'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* buyers                                                              */
/* ------------------------------------------------------------------ */

const buyers = mysqlTable(
  'buyers',
  {
    id: int('id').autoincrement().primaryKey(),
    buyerCode: varchar('buyer_code', { length: 20 }).notNull().unique(),
    buyerName: varchar('buyer_name', { length: 200 }).notNull(),
    contactPerson: varchar('contact_person', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    address: text('address'),
    paymentTerms: varchar('payment_terms', { length: 100 }),
    shippingTerms: varchar('shipping_terms', { length: 100 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_buyers_name').on(table.buyerName)]
);

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

const styles = mysqlTable(
  'styles',
  {
    id: int('id').autoincrement().primaryKey(),
    styleNumber: varchar('style_number', { length: 50 }).notNull().unique(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    category: varchar('category', { length: 100 }),
    season: varchar('season', { length: 50 }),
    buyerId: int('buyer_id').references(() => buyers.id, { onDelete: 'set null' }),
    smv: decimal('smv', { precision: 8, scale: 3 }),
    sizeRange: json('size_range'),
    colorRange: json('color_range'),
    productionRoute: text('production_route'),
    status: mysqlEnum('status', ['Active', 'Inactive']).notNull().default('Active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_styles_buyer').on(table.buyerId),
    index('idx_styles_season').on(table.season),
  ]
);

/* ------------------------------------------------------------------ */
/* suppliers (extended)                                                */
/* ------------------------------------------------------------------ */

const suppliers = mysqlTable(
  'suppliers',
  {
    id: int('id').autoincrement().primaryKey(),
    supplierCode: varchar('supplier_code', { length: 20 }),
    supplierName: varchar('supplier_name', { length: 200 }).notNull(),
    contactPerson: varchar('contact_person', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    paymentTerms: varchar('payment_terms', { length: 100 }),
    shippingTerms: varchar('shipping_terms', { length: 100 }),
    rating: int('rating'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_suppliers_name').on(table.supplierName)]
);

/* ------------------------------------------------------------------ */
/* warehouses                                                          */
/* ------------------------------------------------------------------ */

const warehouses = mysqlTable('warehouses', {
  id: int('id').autoincrement().primaryKey(),
  warehouseCode: varchar('warehouse_code', { length: 20 }).notNull().unique(),
  warehouseName: varchar('warehouse_name', { length: 100 }).notNull(),
  location: varchar('location', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* test_materials (material master, extended)                          */
/* ------------------------------------------------------------------ */

const testMaterials = mysqlTable(
  'test_materials',
  {
    id: int('id').autoincrement().primaryKey(),
    materialCode: varchar('material_code', { length: 50 }).notNull().unique(),
    materialName: varchar('material_name', { length: 200 }).notNull(),
    category: mysqlEnum('category', CATEGORIES).notNull(),
    supplierId: int('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    stockQuantity: decimal('stock_quantity', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    safetyStock: decimal('safety_stock', { precision: 12, scale: 3 }).default('0'),
    unit: varchar('unit', { length: 20 }).notNull().default('pcs'),
    rackLocation: varchar('rack_location', { length: 100 }),
    warehouseId: int('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    testStatus: mysqlEnum('test_status', TEST_STATUSES).notNull().default('Pending'),
    documentUrl: varchar('document_url', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_materials_supplier').on(table.supplierId),
    index('idx_materials_status').on(table.testStatus),
    index('idx_materials_category').on(table.category),
    index('idx_materials_warehouse').on(table.warehouseId),
  ]
);

/* ------------------------------------------------------------------ */
/* sales_orders + lines + amendments                                   */
/* ------------------------------------------------------------------ */

const salesOrders = mysqlTable(
  'sales_orders',
  {
    id: int('id').autoincrement().primaryKey(),
    orderNo: varchar('order_no', { length: 50 }).notNull().unique(),
    buyerId: int('buyer_id').notNull().references(() => buyers.id, {
      onDelete: 'restrict',
    }),
    orderDate: date('order_date').notNull(),
    deliveryDate: date('delivery_date').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    orderStatus: mysqlEnum('order_status', ORDER_STATUSES).notNull().default('Draft'),
    priority: mysqlEnum('priority', ['Normal', 'High', 'Urgent']).notNull().default('Normal'),
    remarks: text('remarks'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_buyer').on(table.buyerId),
    index('idx_orders_delivery').on(table.deliveryDate),
    index('idx_orders_status').on(table.orderStatus),
  ]
);

const salesOrderLines = mysqlTable(
  'sales_order_lines',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => salesOrders.id, { onDelete: 'cascade' }),
    styleId: int('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'restrict' }),
    color: varchar('color', { length: 50 }).notNull(),
    quantity: int('quantity').notNull(),
    sizeBreakdown: json('size_breakdown'),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }),
    bomVersionId: int('bom_version_id').references(() => bomVersions.id, {
      onDelete: 'set null',
    }),
    lineStatus: mysqlEnum('line_status', LINE_STATUSES).notNull().default('Booked'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_order_lines_order').on(table.orderId),
    index('idx_order_lines_style').on(table.styleId),
  ]
);

const orderAmendments = mysqlTable(
  'order_amendments',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => salesOrders.id, { onDelete: 'cascade' }),
    field: varchar('field', { length: 50 }).notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    amendedBy: int('amended_by').references(() => users.id, { onDelete: 'set null' }),
    amendedAt: timestamp('amended_at').defaultNow().notNull(),
  },
  (table) => [index('idx_amendments_order').on(table.orderId)]
);

/* ------------------------------------------------------------------ */
/* BOM versions + items                                                */
/* ------------------------------------------------------------------ */

const bomVersions = mysqlTable(
  'bom_versions',
  {
    id: int('id').autoincrement().primaryKey(),
    styleId: int('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'cascade' }),
    versionNo: int('version_no').notNull(),
    status: mysqlEnum('status', BOM_STATUSES).notNull().default('Draft'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_bom_style_version').on(table.styleId, table.versionNo),
    index('idx_bom_style').on(table.styleId),
  ]
);

const bomItems = mysqlTable(
  'bom_items',
  {
    id: int('id').autoincrement().primaryKey(),
    bomVersionId: int('bom_version_id')
      .notNull()
      .references(() => bomVersions.id, { onDelete: 'cascade' }),
    materialId: int('material_id').references(() => testMaterials.id, {
      onDelete: 'set null',
    }),
    materialName: varchar('material_name', { length: 200 }),
    category: mysqlEnum('category', CATEGORIES),
    unit: varchar('unit', { length: 20 }),
    consumption: decimal('consumption', { precision: 12, scale: 4 }).notNull(),
    wastagePct: decimal('wastage_pct', { precision: 5, scale: 2 }).notNull().default('0'),
    colorDependent: boolean('color_dependent').notNull().default(false),
    sizeDependent: boolean('size_dependent').notNull().default(false),
    preferredSupplierId: int('preferred_supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_bom_items_version').on(table.bomVersionId)]
);

/* ------------------------------------------------------------------ */
/* Material requirements (MRP results)                                 */
/* ------------------------------------------------------------------ */

const materialRequirements = mysqlTable(
  'material_requirements',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => salesOrders.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'cascade' }),
    bomVersionId: int('bom_version_id').references(() => bomVersions.id, {
      onDelete: 'set null',
    }),
    grossQty: decimal('gross_qty', { precision: 14, scale: 3 }).notNull(),
    wastageQty: decimal('wastage_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    netQty: decimal('net_qty', { precision: 14, scale: 3 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_req_order_material').on(table.orderId, table.materialId),
    index('idx_req_material').on(table.materialId),
  ]
);

/* ------------------------------------------------------------------ */
/* Reservations                                                        */
/* ------------------------------------------------------------------ */

const materialReservations = mysqlTable(
  'material_reservations',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => salesOrders.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'cascade' }),
    qty: decimal('qty', { precision: 14, scale: 3 }).notNull(),
    status: mysqlEnum('status', RESERVATION_STATUSES).notNull().default('Active'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_res_order').on(table.orderId),
    index('idx_res_material').on(table.materialId),
    index('idx_res_status').on(table.status),
  ]
);

/* ------------------------------------------------------------------ */
/* Purchase requisitions                                               */
/* ------------------------------------------------------------------ */

const purchaseRequisitions = mysqlTable(
  'purchase_requisitions',
  {
    id: int('id').autoincrement().primaryKey(),
    prNo: varchar('pr_no', { length: 30 }).notNull().unique(),
    orderId: int('order_id').references(() => salesOrders.id, { onDelete: 'set null' }),
    status: mysqlEnum('status', PR_STATUSES).notNull().default('Draft'),
    requiredDate: date('required_date'),
    remarks: text('remarks'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_pr_order').on(table.orderId),
    index('idx_pr_status').on(table.status),
  ]
);

const purchaseRequisitionItems = mysqlTable(
  'purchase_requisition_items',
  {
    id: int('id').autoincrement().primaryKey(),
    prId: int('pr_id')
      .notNull()
      .references(() => purchaseRequisitions.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    qty: decimal('qty', { precision: 14, scale: 3 }).notNull(),
    reason: varchar('reason', { length: 200 }),
    requiredDate: date('required_date'),
  },
  (table) => [index('idx_pr_items_pr').on(table.prId)]
);

/* ------------------------------------------------------------------ */
/* Supplier materials + price history                                  */
/* ------------------------------------------------------------------ */

const supplierMaterials = mysqlTable(
  'supplier_materials',
  {
    id: int('id').autoincrement().primaryKey(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'cascade' }),
    moq: decimal('moq', { precision: 14, scale: 3 }),
    unitPrice: decimal('unit_price', { precision: 14, scale: 4 }),
    leadTimeDays: int('lead_time_days'),
    isPreferred: boolean('is_preferred').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('uq_supplier_material').on(table.supplierId, table.materialId),
    index('idx_sm_material').on(table.materialId),
  ]
);

const supplierPriceHistory = mysqlTable(
  'supplier_price_history',
  {
    id: int('id').autoincrement().primaryKey(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'cascade' }),
    unitPrice: decimal('unit_price', { precision: 14, scale: 4 }).notNull(),
    priceDate: date('price_date').notNull(),
    remarks: varchar('remarks', { length: 200 }),
  },
  (table) => [
    index('idx_ph_supplier_material').on(table.supplierId, table.materialId),
  ]
);

/* ------------------------------------------------------------------ */
/* Purchase orders                                                     */
/* ------------------------------------------------------------------ */

const purchaseOrders = mysqlTable(
  'purchase_orders',
  {
    id: int('id').autoincrement().primaryKey(),
    poNo: varchar('po_no', { length: 30 }).notNull().unique(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    prId: int('pr_id').references(() => purchaseRequisitions.id, {
      onDelete: 'set null',
    }),
    orderDate: date('order_date').notNull(),
    deliveryDate: date('delivery_date'),
    status: mysqlEnum('status', PO_STATUSES).notNull().default('Draft'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    remarks: text('remarks'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_po_supplier').on(table.supplierId),
    index('idx_po_status').on(table.status),
    index('idx_po_pr').on(table.prId),
  ]
);

const purchaseOrderItems = mysqlTable(
  'purchase_order_items',
  {
    id: int('id').autoincrement().primaryKey(),
    poId: int('po_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    qty: decimal('qty', { precision: 14, scale: 3 }).notNull(),
    unitPrice: decimal('unit_price', { precision: 14, scale: 4 }),
    receivedQty: decimal('received_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    cancelledQty: decimal('cancelled_qty', { precision: 14, scale: 3 }).notNull().default('0'),
  },
  (table) => [index('idx_po_items_po').on(table.poId)]
);

/* ------------------------------------------------------------------ */
/* Goods receipts (GRN)                                                */
/* ------------------------------------------------------------------ */

const goodsReceipts = mysqlTable(
  'goods_receipts',
  {
    id: int('id').autoincrement().primaryKey(),
    grnNo: varchar('grn_no', { length: 30 }).notNull().unique(),
    poId: int('po_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
    supplierId: int('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    receivedDate: date('received_date').notNull(),
    invoiceNo: varchar('invoice_no', { length: 50 }),
    deliveryChallanNo: varchar('challan_no', { length: 50 }),
    warehouseId: int('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
    status: mysqlEnum('status', GRN_STATUSES).notNull().default('Pending_QC'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_grn_po').on(table.poId), index('idx_grn_status').on(table.status)]
);

const goodsReceiptItems = mysqlTable(
  'goods_receipt_items',
  {
    id: int('id').autoincrement().primaryKey(),
    grnId: int('grn_id')
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: 'cascade' }),
    poItemId: int('po_item_id').references(() => purchaseOrderItems.id, {
      onDelete: 'set null',
    }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    receivedQty: decimal('received_qty', { precision: 14, scale: 3 }).notNull(),
    acceptedQty: decimal('accepted_qty', { precision: 14, scale: 3 }).notNull(),
    rejectedQty: decimal('rejected_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    batch: varchar('batch', { length: 50 }),
    lot: varchar('lot', { length: 50 }),
    remarks: text('remarks'),
  },
  (table) => [index('idx_grn_items_grn').on(table.grnId)]
);

/* ------------------------------------------------------------------ */
/* Fabric rolls                                                        */
/* ------------------------------------------------------------------ */

const fabricRolls = mysqlTable(
  'fabric_rolls',
  {
    id: int('id').autoincrement().primaryKey(),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'cascade' }),
    grnItemId: int('grn_item_id').references(() => goodsReceiptItems.id, {
      onDelete: 'set null',
    }),
    rollNo: varchar('roll_no', { length: 50 }).notNull(),
    length: decimal('length', { precision: 10, scale: 2 }).notNull(),
    width: decimal('width', { precision: 6, scale: 2 }),
    shade: varchar('shade', { length: 50 }),
    batch: varchar('batch', { length: 50 }),
    lot: varchar('lot', { length: 50 }),
    gsm: int('gsm'),
    remainingLength: decimal('remaining_length', { precision: 10, scale: 2 }).notNull(),
    status: mysqlEnum('status', ['In_Stock', 'Partial', 'Finished']).notNull().default('In_Stock'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_rolls_material').on(table.materialId)]
);

/* ------------------------------------------------------------------ */
/* Stock ledger + adjustments                                          */
/* ------------------------------------------------------------------ */

const stockTransactions = mysqlTable(
  'stock_transactions',
  {
    id: int('id').autoincrement().primaryKey(),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    transactionType: mysqlEnum('transaction_type', TRANSACTION_TYPES).notNull(),
    qty: decimal('qty', { precision: 14, scale: 3 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 14, scale: 3 }).notNull(),
    warehouseId: int('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    referenceType: varchar('reference_type', { length: 30 }),
    referenceId: int('reference_id'),
    remarks: varchar('remarks', { length: 255 }),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ledger_material').on(table.materialId),
    index('idx_ledger_ref').on(table.referenceType, table.referenceId),
  ]
);

const stockAdjustments = mysqlTable(
  'stock_adjustments',
  {
    id: int('id').autoincrement().primaryKey(),
    adjustmentNo: varchar('adjustment_no', { length: 30 }).notNull().unique(),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    qty: decimal('qty', { precision: 14, scale: 3 }).notNull(),
    reason: varchar('reason', { length: 200 }).notNull(),
    status: mysqlEnum('status', ADJUSTMENT_STATUSES).notNull().default('Pending'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: int('approved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_adj_material').on(table.materialId)]
);

/* ------------------------------------------------------------------ */
/* Production                                                          */
/* ------------------------------------------------------------------ */

const productionOrders = mysqlTable(
  'production_orders',
  {
    id: int('id').autoincrement().primaryKey(),
    productionOrderNo: varchar('production_order_no', { length: 30 }).notNull().unique(),
    salesOrderLineId: int('sales_order_line_id')
      .notNull()
      .references(() => salesOrderLines.id, { onDelete: 'restrict' }),
    styleId: int('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'restrict' }),
    qty: int('qty').notNull(),
    status: mysqlEnum('status', PRODUCTION_STATUSES).notNull().default('Planned'),
    line: varchar('line', { length: 30 }),
    plannedStart: date('planned_start'),
    plannedEnd: date('planned_end'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_po_line').on(table.salesOrderLineId),
    index('idx_po_status').on(table.status),
  ]
);

const materialIssues = mysqlTable(
  'material_issues',
  {
    id: int('id').autoincrement().primaryKey(),
    issueNo: varchar('issue_no', { length: 30 }).notNull().unique(),
    productionOrderId: int('production_order_id').references(() => productionOrders.id, {
      onDelete: 'set null',
    }),
    warehouseId: int('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    issuedTo: varchar('issued_to', { length: 100 }),
    status: mysqlEnum('status', ISSUE_STATUSES).notNull().default('Requested'),
    issueDate: date('issue_date'),
    remarks: text('remarks'),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_mi_status').on(table.status), index('idx_mi_prod').on(table.productionOrderId)]
);

const materialIssueItems = mysqlTable(
  'material_issue_items',
  {
    id: int('id').autoincrement().primaryKey(),
    issueId: int('issue_id')
      .notNull()
      .references(() => materialIssues.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    requestedQty: decimal('requested_qty', { precision: 14, scale: 3 }).notNull(),
    issuedQty: decimal('issued_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    unit: varchar('unit', { length: 20 }),
  },
  (table) => [index('idx_mii_issue').on(table.issueId)]
);

const cuttingPlans = mysqlTable(
  'cutting_plans',
  {
    id: int('id').autoincrement().primaryKey(),
    cuttingPlanNo: varchar('cutting_plan_no', { length: 30 }).notNull().unique(),
    productionOrderId: int('production_order_id')
      .notNull()
      .references(() => productionOrders.id, { onDelete: 'cascade' }),
    markerNo: varchar('marker_no', { length: 50 }),
    layNo: varchar('lay_no', { length: 50 }),
    cutQty: int('cut_qty'),
    status: mysqlEnum('status', ['Planned', 'In_Progress', 'Completed']).notNull().default('Planned'),
    plannedDate: date('planned_date'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_cp_prod').on(table.productionOrderId)]
);

const cuttingPlanItems = mysqlTable(
  'cutting_plan_items',
  {
    id: int('id').autoincrement().primaryKey(),
    cuttingPlanId: int('cutting_plan_id')
      .notNull()
      .references(() => cuttingPlans.id, { onDelete: 'cascade' }),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'restrict' }),
    plannedConsumption: decimal('planned_consumption', { precision: 14, scale: 3 }).notNull(),
    actualConsumption: decimal('actual_consumption', { precision: 14, scale: 3 }),
    wastageQty: decimal('wastage_qty', { precision: 14, scale: 3 }),
    shortageQty: decimal('shortage_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    excessQty: decimal('excess_qty', { precision: 14, scale: 3 }).notNull().default('0'),
  },
  (table) => [index('idx_cpi_plan').on(table.cuttingPlanId)]
);

const cuttingBundles = mysqlTable(
  'cutting_bundles',
  {
    id: int('id').autoincrement().primaryKey(),
    cuttingPlanId: int('cutting_plan_id')
      .notNull()
      .references(() => cuttingPlans.id, { onDelete: 'cascade' }),
    bundleNo: varchar('bundle_no', { length: 50 }).notNull(),
    size: varchar('size', { length: 20 }),
    color: varchar('color', { length: 50 }),
    panelCount: int('panel_count'),
    qty: int('qty').notNull(),
  },
  (table) => [index('idx_cb_plan').on(table.cuttingPlanId)]
);

const productionOutput = mysqlTable(
  'production_output',
  {
    id: int('id').autoincrement().primaryKey(),
    productionOrderId: int('production_order_id')
      .notNull()
      .references(() => productionOrders.id, { onDelete: 'cascade' }),
    stage: mysqlEnum('stage', OUTPUT_STAGES).notNull(),
    qty: int('qty').notNull(),
    rejectionQty: int('rejection_qty').notNull().default(0),
    operatorId: int('operator_id').references(() => users.id, { onDelete: 'set null' }),
    remarks: varchar('remarks', { length: 200 }),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => [index('idx_output_prod').on(table.productionOrderId)]
);

/* ------------------------------------------------------------------ */
/* Quality checks                                                      */
/* ------------------------------------------------------------------ */

const qualityChecks = mysqlTable(
  'quality_checks',
  {
    id: int('id').autoincrement().primaryKey(),
    checkNo: varchar('check_no', { length: 30 }).notNull().unique(),
    referenceType: mysqlEnum('reference_type', QC_TYPES).notNull(),
    referenceId: int('reference_id'),
    productionOrderId: int('production_order_id').references(() => productionOrders.id, {
      onDelete: 'set null',
    }),
    checkedBy: int('checked_by').references(() => users.id, { onDelete: 'set null' }),
    result: mysqlEnum('result', QC_RESULTS).notNull(),
    defectCode: varchar('defect_code', { length: 50 }),
    defectQty: int('defect_qty').notNull().default(0),
    remarks: text('remarks'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => [index('idx_qc_prod').on(table.productionOrderId)]
);

const materialTestLogs = mysqlTable(
  'material_test_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    materialId: int('material_id')
      .notNull()
      .references(() => testMaterials.id, { onDelete: 'cascade' }),
    testedBy: int('tested_by').references(() => users.id, { onDelete: 'set null' }),
    testResult: varchar('test_result', { length: 20 }).notNull(),
    remarks: text('remarks'),
    testedAt: timestamp('tested_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_logs_material').on(table.materialId),
    index('idx_logs_tested_by').on(table.testedBy),
  ]
);

/* ------------------------------------------------------------------ */
/* Finished goods + shipments                                          */
/* ------------------------------------------------------------------ */

const finishedGoods = mysqlTable(
  'finished_goods',
  {
    id: int('id').autoincrement().primaryKey(),
    fgNo: varchar('fg_no', { length: 30 }).notNull().unique(),
    productionOrderId: int('production_order_id').references(() => productionOrders.id, {
      onDelete: 'set null',
    }),
    salesOrderLineId: int('sales_order_line_id').references(() => salesOrderLines.id, {
      onDelete: 'set null',
    }),
    styleId: int('style_id').references(() => styles.id, { onDelete: 'set null' }),
    color: varchar('color', { length: 50 }),
    size: varchar('size', { length: 20 }),
    qty: int('qty').notNull(),
    cartonNo: varchar('carton_no', { length: 50 }),
    status: mysqlEnum('status', FG_STATUSES).notNull().default('In_Stock'),
    warehouseId: int('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_fg_prod').on(table.productionOrderId), index('idx_fg_status').on(table.status)]
);

const shipments = mysqlTable(
  'shipments',
  {
    id: int('id').autoincrement().primaryKey(),
    shipmentNo: varchar('shipment_no', { length: 30 }).notNull().unique(),
    salesOrderId: int('sales_order_id').references(() => salesOrders.id, {
      onDelete: 'set null',
    }),
    buyerId: int('buyer_id').references(() => buyers.id, { onDelete: 'set null' }),
    destination: varchar('destination', { length: 200 }),
    shipmentDate: date('shipment_date'),
    status: mysqlEnum('status', SHIPMENT_STATUSES).notNull().default('Planned'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_ship_order').on(table.salesOrderId), index('idx_ship_status').on(table.status)]
);

const shipmentItems = mysqlTable(
  'shipment_items',
  {
    id: int('id').autoincrement().primaryKey(),
    shipmentId: int('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    salesOrderLineId: int('sales_order_line_id').references(() => salesOrderLines.id, {
      onDelete: 'set null',
    }),
    qty: int('qty').notNull(),
    cartons: int('cartons').notNull().default(0),
    sizeBreakdown: json('size_breakdown'),
  },
  (table) => [index('idx_ship_items_ship').on(table.shipmentId)]
);

/* ------------------------------------------------------------------ */
/* Document sequences (race-safe numbering)                            */
/* ------------------------------------------------------------------ */

const documentSequences = mysqlTable('document_sequences', {
  id: int('id').autoincrement().primaryKey(),
  docType: varchar('doc_type', { length: 20 }).notNull().unique(),
  lastNo: int('last_no').notNull().default(0),
});

module.exports = {
  users,
  buyers,
  styles,
  suppliers,
  warehouses,
  testMaterials,
  salesOrders,
  salesOrderLines,
  orderAmendments,
  bomVersions,
  bomItems,
  materialRequirements,
  materialReservations,
  purchaseRequisitions,
  purchaseRequisitionItems,
  supplierMaterials,
  supplierPriceHistory,
  purchaseOrders,
  purchaseOrderItems,
  goodsReceipts,
  goodsReceiptItems,
  fabricRolls,
  stockTransactions,
  stockAdjustments,
  productionOrders,
  materialIssues,
  materialIssueItems,
  cuttingPlans,
  cuttingPlanItems,
  cuttingBundles,
  productionOutput,
  qualityChecks,
  materialTestLogs,
  finishedGoods,
  shipments,
  shipmentItems,
  documentSequences,
  ROLES,
  CATEGORIES,
  TEST_STATUSES,
  ORDER_STATUSES,
  LINE_STATUSES,
  BOM_STATUSES,
  RESERVATION_STATUSES,
  PR_STATUSES,
  PO_STATUSES,
  GRN_STATUSES,
  ADJUSTMENT_STATUSES,
  PRODUCTION_STATUSES,
  OUTPUT_STAGES,
  QC_TYPES,
  QC_RESULTS,
  FG_STATUSES,
  SHIPMENT_STATUSES,
  ISSUE_STATUSES,
  TRANSACTION_TYPES,
};
