/**
 * Seed script - populates demo users, suppliers and sample materials.
 *
 * Run with:  npm run db:seed   (from the server/ directory)
 *
 * The script is idempotent: it skips records that already exist.
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const { db, pool } = require('../config/db');
const {
  users,
  suppliers,
  testMaterials,
  warehouses,
  buyers,
  styles,
  bomVersions,
  bomItems,
  salesOrders,
  salesOrderLines,
} = require('./schema');

const DEMO_PASSWORD = '123456';

async function seedUsers() {
  const demoUsers = [
    { name: 'System Admin', email: 'Ratul', role: 'Admin' },
    { name: 'Store Manager', email: 'store@factory.com', role: 'Store_Manager' },
    { name: 'QA Inspector', email: 'qa@factory.com', role: 'QA_Inspector' },
    { name: 'Merchandiser', email: 'merch@factory.com', role: 'Merchandiser' },
  ];

  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
  let count = 0;

  for (const user of demoUsers) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, user.email)).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({ ...user, password: hashed });
      count += 1;
    }
  }

  console.log(`[seed] users: ${count} inserted (password for all: ${DEMO_PASSWORD})`);
}

async function seedSuppliers() {
  const demoSuppliers = [
    { supplierName: 'HKD Outdoor Textiles Ltd.', contactPerson: 'Mr. Rafiq Ahmed', phone: '+880 1711-000111', email: 'rafiq@hkdtextiles.com' },
    { supplierName: 'Gulshan Trims & Buttons', contactPerson: 'Ms. Nusrat Jahan', phone: '+880 1812-222333', email: 'nusrat@gulshentrims.com' },
    { supplierName: 'Bangladesh Zipper Co.', contactPerson: 'Mr. Tanvir Hossain', phone: '+880 1613-444555', email: 'tanvir@bdzipper.com' },
    { supplierName: 'Savar Fabric Mills', contactPerson: 'Mr. Imran Chowdhury', phone: '+880 1914-666777', email: 'imran@savarfabrics.com' },
    { supplierName: 'Knit Accessories House', contactPerson: 'Ms. Farhana Yasmin', phone: '+880 1515-888999', email: 'farhana@knitaccessories.com' },
  ];

  let count = 0;
  for (const supplier of demoSuppliers) {
    const existing = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.supplierName, supplier.supplierName))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(suppliers).values(supplier);
      count += 1;
    }
  }

  console.log(`[seed] suppliers: ${count} inserted`);
}

async function seedWarehouse() {
  const [existing] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.warehouseCode, 'MW-01'))
    .limit(1);
  if (!existing) {
    await db.insert(warehouses).values({
      warehouseCode: 'MW-01',
      warehouseName: 'Main Material Warehouse',
      location: 'Factory Building A, Ground Floor',
    });
    console.log('[seed] warehouses: 1 inserted');
  } else {
    console.log('[seed] warehouses: skipped (exists)');
  }
}

async function seedErp() {
  // Buyer: Columbia
  const [existingBuyer] = await db
    .select({ id: buyers.id })
    .from(buyers)
    .where(eq(buyers.buyerCode, 'COL'))
    .limit(1);
  let buyerId;
  if (existingBuyer) {
    buyerId = existingBuyer.id;
  } else {
    const [ins] = await db.insert(buyers).values({
      buyerCode: 'COL',
      buyerName: 'Columbia Sportswear',
      contactPerson: 'Mr. David Chen',
      email: 'david.chen@columbia.com',
      phone: '+1 503-985-4000',
      address: '14375 NW Science Park Drive, Portland, OR 97229, USA',
      paymentTerms: 'Net 60 days',
      shippingTerms: 'FOB Chittagong',
      currency: 'USD',
      isActive: true,
    });
    buyerId = ins.insertId;
    console.log('[seed] buyers: Columbia inserted');
  }

  // Style: JK-1001
  const [existingStyle] = await db
    .select({ id: styles.id })
    .from(styles)
    .where(eq(styles.styleNumber, 'JK-1001'))
    .limit(1);
  let styleId;
  if (existingStyle) {
    styleId = existingStyle.id;
  } else {
    const [ins] = await db.insert(styles).values({
      styleNumber: 'JK-1001',
      productName: 'Outdoor Jacket - Shell',
      category: 'Outerwear',
      season: 'FW26',
      buyerId,
      smv: '28.500',
      sizeRange: ['S', 'M', 'L', 'XL', 'XXL'],
      colorRange: ['Black', 'Navy', 'Red'],
      productionRoute: 'Cutting → Sewing → Finishing → Packing',
      status: 'Active',
    });
    styleId = ins.insertId;
    console.log('[seed] styles: JK-1001 inserted');
  }

  // BOM version 1 (only if none exists)
  const [existingBom] = await db
    .select({ id: bomVersions.id })
    .from(bomVersions)
    .where(eq(bomVersions.styleId, styleId))
    .limit(1);
  let bomId;
  if (existingBom) {
    bomId = existingBom.id;
    console.log('[seed] bom: skipped (exists)');
  } else {
    const [ins] = await db.insert(bomVersions).values({
      styleId,
      versionNo: 1,
      status: 'Active',
      remarks: 'Initial costed BOM - FW26',
    });
    bomId = ins.insertId;

    // Materials referenced by code from the material seed above.
    const mats = await db.select().from(testMaterials);
    const byCode = (code) => mats.find((m) => m.materialCode === code) || null;
    const byName = (name) => mats.find((m) => m.materialName.toLowerCase().includes(name.toLowerCase())) || null;

    const bomRows = [
      { code: 'FBR-2401', name: 'Ripstop Nylon 210D', consumption: '1.80', wastage: '5.0' },
      { code: 'FBR-2402', name: 'Polyester Taffeta 190T', consumption: '0.90', wastage: '5.0' },
      { code: 'ZIP-3301', name: 'YKK #5 Coil Zipper', consumption: '1', wastage: '2.0' },
      { code: 'ACC-5501', name: 'D-Ring Metal 20mm', consumption: '4', wastage: '3.0' },
      { code: null, name: 'Thread', consumption: '120', wastage: '3.0' },
      { code: null, name: 'Hangtag', consumption: '1', wastage: '1.0' },
      { code: null, name: 'Polybag', consumption: '1', wastage: '1.0' },
    ];

    for (const row of bomRows) {
      const material = row.code ? byCode(row.code) : byName(row.name);
      await db.insert(bomItems).values({
        bomVersionId: bomId,
        materialId: material ? material.id : null,
        materialName: row.name,
        category: material ? material.category : 'Trim',
        unit: material ? material.unit : 'm',
        consumption: row.consumption,
        wastagePct: row.wastage,
        colorDependent: false,
        sizeDependent: false,
      });
    }
    console.log('[seed] bom: version 1 with 7 items inserted');
  }

  // Sales Order: COL-2026-001 (only if none exists)
  const [existingOrder] = await db
    .select({ id: salesOrders.id })
    .from(salesOrders)
    .where(eq(salesOrders.orderNo, 'COL-2026-001'))
    .limit(1);
  if (!existingOrder) {
    const [ins] = await db.insert(salesOrders).values({
      orderNo: 'COL-2026-001',
      buyerId,
      orderDate: '2026-01-15',
      deliveryDate: '2026-10-20',
      currency: 'USD',
      orderStatus: 'Booked',
      priority: 'High',
      remarks: 'FW26 outdoor jacket program',
      createdBy: 1,
    });
    const orderId = ins.insertId;

    // Multi-line: Black 1000, Navy 800, Red 500
    const colors = [
      { color: 'Black', quantity: 1000, breakdown: { S: 100, M: 250, L: 300, XL: 250, XXL: 100 } },
      { color: 'Navy', quantity: 800, breakdown: { S: 80, M: 200, L: 240, XL: 200, XXL: 80 } },
      { color: 'Red', quantity: 500, breakdown: { S: 50, M: 125, L: 150, XL: 125, XXL: 50 } },
    ];
    for (const c of colors) {
      await db.insert(salesOrderLines).values({
        orderId,
        styleId,
        color: c.color,
        quantity: c.quantity,
        sizeBreakdown: c.breakdown,
        unitPrice: '18.50',
        bomVersionId: bomId,
        lineStatus: 'Booked',
      });
    }
    console.log('[seed] orders: COL-2026-001 with 3 lines inserted');
  } else {
    console.log('[seed] orders: skipped (exists)');
  }
}

async function seedMaterials() {
  const allSuppliers = await db.select().from(suppliers);
  const byName = (name) => allSuppliers.find((s) => s.supplierName === name) || null;

  const demoMaterials = [
    { materialCode: 'FBR-2401', materialName: 'Ripstop Nylon 210D', category: 'Fabric', supplier: 'Savar Fabric Mills', stockQuantity: 2500, unit: 'yd', rackLocation: 'A-01-01', testStatus: 'Passed' },
    { materialCode: 'FBR-2402', materialName: 'Polyester Taffeta 190T', category: 'Fabric', supplier: 'HKD Outdoor Textiles Ltd.', stockQuantity: 1800, unit: 'yd', rackLocation: 'A-01-02', testStatus: 'Passed' },
    { materialCode: 'FBR-2403', materialName: 'Canvas Cotton 12oz', category: 'Fabric', supplier: 'Savar Fabric Mills', stockQuantity: 600, unit: 'yd', rackLocation: 'A-02-01', testStatus: 'Pending' },
    { materialCode: 'TRM-1101', materialName: 'Reflective Tape 25mm', category: 'Trim', supplier: 'Gulshan Trims & Buttons', stockQuantity: 4200, unit: 'm', rackLocation: 'B-01-01', testStatus: 'Passed' },
    { materialCode: 'TRM-1102', materialName: 'Hook & Loop 50mm (Velcro)', category: 'Trim', supplier: 'Gulshan Trims & Buttons', stockQuantity: 950, unit: 'm', rackLocation: 'B-01-02', testStatus: 'Failed' },
    { materialCode: 'ZIP-3301', materialName: 'YKK #5 Coil Zipper', category: 'Zipper', supplier: 'Bangladesh Zipper Co.', stockQuantity: 12000, unit: 'pcs', rackLocation: 'C-01-01', testStatus: 'Passed' },
    { materialCode: 'ZIP-3302', materialName: 'Vislon #8 Zipper', category: 'Zipper', supplier: 'Bangladesh Zipper Co.', stockQuantity: 300, unit: 'pcs', rackLocation: 'C-01-02', testStatus: 'Pending' },
    { materialCode: 'ELC-2201', materialName: 'Elastic Band 40mm', category: 'Elastic', supplier: 'Knit Accessories House', stockQuantity: 2100, unit: 'm', rackLocation: 'D-01-01', testStatus: 'Passed' },
    { materialCode: 'WEB-4401', materialName: 'Nylon Webbing 25mm', category: 'Webbing', supplier: 'HKD Outdoor Textiles Ltd.', stockQuantity: 1500, unit: 'm', rackLocation: 'D-02-01', testStatus: 'Pending' },
    { materialCode: 'ACC-5501', materialName: 'D-Ring Metal 20mm', category: 'Accessory', supplier: 'Gulshan Trims & Buttons', stockQuantity: 8000, unit: 'pcs', rackLocation: 'E-01-01', testStatus: 'Passed' },
    { materialCode: 'ACC-5502', materialName: 'Cord Lock Plastic 12mm', category: 'Accessory', supplier: 'Knit Accessories House', stockQuantity: 250, unit: 'pcs', rackLocation: 'E-01-02', testStatus: 'Failed' },
  ];

  const demoDocumentUrl =
    'https://res.cloudinary.com/df8fxkmdo/image/upload/v1710000000/test-material-warehouse/demo-quality-certificate.pdf';

  let count = 0;
  for (const m of demoMaterials) {
    const existing = await db
      .select({ id: testMaterials.id })
      .from(testMaterials)
      .where(eq(testMaterials.materialCode, m.materialCode))
      .limit(1);

    if (existing.length === 0) {
      const supplier = byName(m.supplier);
      await db.insert(testMaterials).values({
        materialCode: m.materialCode,
        materialName: m.materialName,
        category: m.category,
        supplierId: supplier ? supplier.id : null,
        stockQuantity: m.stockQuantity,
        unit: m.unit,
        rackLocation: m.rackLocation,
        testStatus: m.testStatus,
        documentUrl: m.testStatus === 'Passed' ? demoDocumentUrl : null,
      });
      count += 1;
    }
  }

  console.log(`[seed] materials: ${count} inserted`);
}

(async () => {
  try {
    await seedUsers();
    await seedSuppliers();
    await seedMaterials();
    await seedWarehouse();
    await seedErp();
    console.log('[seed] Done.');
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
