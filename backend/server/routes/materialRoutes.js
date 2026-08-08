/**
 * Material inventory routes.
 *
 *   GET  /api/materials            -> list all materials (joined with supplier
 *                                     names + latest test log)
 *   POST /api/materials            -> create a material (multipart, optional
 *                                     Cloudinary certificate upload)
 *   PUT  /api/materials/:id/status -> update test status + insert an audit log
 *                                     row inside a transaction
 */
const { Router } = require('express');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { testMaterials, suppliers, materialTestLogs, users, CATEGORIES, TEST_STATUSES } = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { cloudinary, uploadDocument } = require('../config/cloudinary');

const router = Router();

/**
 * If multer already pushed a file to Cloudinary but the request fails
 * validation, remove the orphaned asset so the bucket stays clean.
 */
function cleanupUpload(req) {
  if (req.file && req.file.filename) {
    return cloudinary.uploader.destroy(req.file.filename).catch(() => {});
  }
  return Promise.resolve();
}

/* --------------------------- GET / (list all) -------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: testMaterials.id,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      category: testMaterials.category,
      supplierId: testMaterials.supplierId,
      supplierName: suppliers.supplierName,
      stockQuantity: testMaterials.stockQuantity,
      unit: testMaterials.unit,
      rackLocation: testMaterials.rackLocation,
      testStatus: testMaterials.testStatus,
      documentUrl: testMaterials.documentUrl,
      createdAt: testMaterials.createdAt,
    })
    .from(testMaterials)
    .leftJoin(suppliers, eq(testMaterials.supplierId, suppliers.id))
    .orderBy(desc(testMaterials.createdAt));

  // Latest test log per material (kept in a separate query to avoid N+1).
  const logs = await db
    .select({
      id: materialTestLogs.id,
      materialId: materialTestLogs.materialId,
      testResult: materialTestLogs.testResult,
      remarks: materialTestLogs.remarks,
      testedAt: materialTestLogs.testedAt,
      testedByName: users.name,
    })
    .from(materialTestLogs)
    .leftJoin(users, eq(materialTestLogs.testedBy, users.id))
    .orderBy(desc(materialTestLogs.testedAt));

  const latestByMaterial = new Map();
  for (const log of logs) {
    if (!latestByMaterial.has(log.materialId)) {
      latestByMaterial.set(log.materialId, log);
    }
  }

  const materials = rows.map((row) => ({
    ...row,
    latestTest: latestByMaterial.get(row.id) || null,
  }));

  return res.json({ materials, total: materials.length });
});

/* --------------------------- POST / (create) --------------------------- */

router.post(
  '/',
  authenticate,
  authorize('Admin', 'Store_Manager'),
  uploadDocument.single('document'),
  async (req, res) => {
    const body = req.body || {};
    const materialCode = (body.material_code || '').trim();
    const materialName = (body.material_name || '').trim();
    const { category } = body;

    if (!materialCode || !materialName || !category) {
      await cleanupUpload(req);
      return res
        .status(400)
        .json({ message: 'material_code, material_name and category are required.' });
    }
    if (!CATEGORIES.includes(category)) {
      await cleanupUpload(req);
      return res.status(400).json({ message: `Category must be one of: ${CATEGORIES.join(', ')}.` });
    }
    if (body.test_status && !TEST_STATUSES.includes(body.test_status)) {
      await cleanupUpload(req);
      return res.status(400).json({ message: `test_status must be one of: ${TEST_STATUSES.join(', ')}.` });
    }

    // Numeric fields must be real, valid integers.
    let supplierId = null;
    if (body.supplier_id !== undefined && body.supplier_id !== '') {
      supplierId = Number(body.supplier_id);
      if (!Number.isInteger(supplierId) || supplierId <= 0) {
        await cleanupUpload(req);
        return res.status(400).json({ message: 'supplier_id must be a positive integer.' });
      }
      const [supplier] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      if (!supplier) {
        await cleanupUpload(req);
        return res.status(400).json({ message: 'Selected supplier does not exist.' });
      }
    }

    let stockQuantity = 0;
    if (body.stock_quantity !== undefined && body.stock_quantity !== '') {
      stockQuantity = Number(body.stock_quantity);
      if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
        await cleanupUpload(req);
        return res.status(400).json({ message: 'stock_quantity must be a non-negative integer.' });
      }
    }

    const duplicate = await db
      .select({ id: testMaterials.id })
      .from(testMaterials)
      .where(eq(testMaterials.materialCode, materialCode))
      .limit(1);

    if (duplicate.length > 0) {
      await cleanupUpload(req);
      return res.status(409).json({ message: `Material code "${materialCode}" already exists.` });
    }

    // multer-storage-cloudinary stores the secure Cloudinary URL in `req.file.path`.
    const documentUrl = req.file ? req.file.path : null;

    const [inserted] = await db.insert(testMaterials).values({
      materialCode,
      materialName,
      category,
      supplierId,
      stockQuantity,
      unit: body.unit || 'pcs',
      rackLocation: body.rack_location || null,
      testStatus: body.test_status || 'Pending',
      documentUrl,
    });

    const [material] = await db
      .select()
      .from(testMaterials)
      .where(eq(testMaterials.id, inserted.insertId))
      .limit(1);

    return res.status(201).json({ message: 'Material added successfully.', material });
  }
);

/* -------------------- PUT /:id/status (test status) -------------------- */

router.put('/:id/status', authenticate, authorize('Admin', 'QA_Inspector'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid material id.' });
  }

  const { testStatus, remarks } = req.body || {};

  if (!testStatus || !TEST_STATUSES.includes(testStatus)) {
    return res.status(400).json({ message: `testStatus must be one of: ${TEST_STATUSES.join(', ')}.` });
  }

  const [existing] = await db
    .select({ id: testMaterials.id })
    .from(testMaterials)
    .where(eq(testMaterials.id, id))
    .limit(1);

  if (!existing) {
    return res.status(404).json({ message: 'Material not found.' });
  }

  // Update the material status AND insert the audit log atomically.
  await db.transaction(async (tx) => {
    await tx.update(testMaterials).set({ testStatus }).where(eq(testMaterials.id, id));
    await tx.insert(materialTestLogs).values({
      materialId: id,
      testedBy: req.user.id,
      testResult: testStatus,
      remarks: remarks ? String(remarks).trim() : null,
    });
  });

  const [material] = await db
    .select()
    .from(testMaterials)
    .where(eq(testMaterials.id, id))
    .limit(1);

  const [log] = await db
    .select({
      id: materialTestLogs.id,
      materialId: materialTestLogs.materialId,
      testResult: materialTestLogs.testResult,
      remarks: materialTestLogs.remarks,
      testedAt: materialTestLogs.testedAt,
      testedByName: users.name,
    })
    .from(materialTestLogs)
    .leftJoin(users, eq(materialTestLogs.testedBy, users.id))
    .where(eq(materialTestLogs.materialId, id))
    .orderBy(desc(materialTestLogs.testedAt))
    .limit(1);

  return res.json({ message: `Test status updated to "${testStatus}".`, material, log });
});

module.exports = router;
