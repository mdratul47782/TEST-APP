/**
 * Style routes + BOM (versioned) management.
 *
 *   GET    /api/styles                     list styles (joined buyer)
 *   GET    /api/styles/:id                 style detail
 *   POST   /api/styles                     create style
 *   PUT    /api/styles/:id                 update style
 *
 *   GET    /api/styles/:id/boms            list BOM versions for a style
 *   POST   /api/styles/:id/boms            create a BOM version (auto version_no)
 *   GET    /api/boms/:versionId            BOM version detail + items
 *   PUT    /api/boms/:versionId/status     activate/supersede a version
 *   POST   /api/boms/:versionId/items      add BOM item
 *   PUT    /api/boms/:versionId/items/:itemId  update BOM item
 *   DELETE /api/boms/:versionId/items/:itemId  delete BOM item
 */
const { Router } = require('express');
const { eq, and, asc, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  styles,
  buyers,
  bomVersions,
  bomItems,
  testMaterials,
  suppliers,
  BOM_STATUSES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

/* ------------------------------- Styles ------------------------------ */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: styles.id,
      styleNumber: styles.styleNumber,
      productName: styles.productName,
      category: styles.category,
      season: styles.season,
      buyerId: styles.buyerId,
      buyerName: buyers.buyerName,
      smv: styles.smv,
      sizeRange: styles.sizeRange,
      colorRange: styles.colorRange,
      status: styles.status,
      createdAt: styles.createdAt,
    })
    .from(styles)
    .leftJoin(buyers, eq(styles.buyerId, buyers.id))
    .orderBy(desc(styles.createdAt));
  return res.json({ styles: rows, total: rows.length });
});

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [style] = await db
    .select({
      id: styles.id,
      styleNumber: styles.styleNumber,
      productName: styles.productName,
      category: styles.category,
      season: styles.season,
      buyerId: styles.buyerId,
      buyerName: buyers.buyerName,
      smv: styles.smv,
      sizeRange: styles.sizeRange,
      colorRange: styles.colorRange,
      productionRoute: styles.productionRoute,
      status: styles.status,
      createdAt: styles.createdAt,
    })
    .from(styles)
    .leftJoin(buyers, eq(styles.buyerId, buyers.id))
    .where(eq(styles.id, id))
    .limit(1);
  if (!style) return res.status(404).json({ message: 'Style not found.' });

  const versions = await db
    .select()
    .from(bomVersions)
    .where(eq(bomVersions.styleId, id))
    .orderBy(desc(bomVersions.versionNo));
  return res.json({ style, bomVersions: versions });
});

router.post('/', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const {
    styleNumber, productName, category, season, buyerId,
    smv, sizeRange, colorRange, productionRoute, status,
  } = req.body || {};
  if (!styleNumber || !productName) {
    return res.status(400).json({ message: 'styleNumber and productName are required.' });
  }
  const existing = await db.select({ id: styles.id }).from(styles).where(eq(styles.styleNumber, styleNumber)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ message: `Style "${styleNumber}" already exists.` });
  }
  const [inserted] = await db.insert(styles).values({
    styleNumber,
    productName,
    category: category || null,
    season: season || null,
    buyerId: buyerId ? Number(buyerId) : null,
    smv: smv !== undefined && smv !== '' ? String(smv) : null,
    sizeRange: sizeRange || null,
    colorRange: colorRange || null,
    productionRoute: productionRoute || null,
    status: status || 'Active',
  });
  const [row] = await db.select().from(styles).where(eq(styles.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Style created.', style: row });
});

router.put('/:id', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select({ id: styles.id }).from(styles).where(eq(styles.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Style not found.' });

  const { productName, category, season, buyerId, smv, sizeRange, colorRange, productionRoute, status } = req.body || {};
  await db.update(styles).set({
    ...(productName ? { productName } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(season !== undefined ? { season } : {}),
    ...(buyerId !== undefined ? { buyerId: buyerId ? Number(buyerId) : null } : {}),
    ...(smv !== undefined ? { smv: smv !== '' ? String(smv) : null } : {}),
    ...(sizeRange !== undefined ? { sizeRange } : {}),
    ...(colorRange !== undefined ? { colorRange } : {}),
    ...(productionRoute !== undefined ? { productionRoute } : {}),
    ...(status ? { status } : {}),
  }).where(eq(styles.id, id));

  const [row] = await db.select().from(styles).where(eq(styles.id, id)).limit(1);
  return res.json({ message: 'Style updated.', style: row });
});

/* ------------------------------ BOM versions ------------------------- */

router.get('/:id/boms', authenticate, async (req, res) => {
  const versions = await db
    .select()
    .from(bomVersions)
    .where(eq(bomVersions.styleId, Number(req.params.id)))
    .orderBy(desc(bomVersions.versionNo));
  return res.json({ bomVersions: versions });
});

router.post('/:id/boms', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const styleId = Number(req.params.id);
  const [style] = await db.select({ id: styles.id }).from(styles).where(eq(styles.id, styleId)).limit(1);
  if (!style) return res.status(404).json({ message: 'Style not found.' });

  const [latest] = await db
    .select({ versionNo: bomVersions.versionNo })
    .from(bomVersions)
    .where(eq(bomVersions.styleId, styleId))
    .orderBy(desc(bomVersions.versionNo))
    .limit(1);
  const versionNo = (latest?.versionNo || 0) + 1;

  const [inserted] = await db.insert(bomVersions).values({
    styleId,
    versionNo,
    status: 'Draft',
    remarks: (req.body || {}).remarks || null,
  });
  const [row] = await db.select().from(bomVersions).where(eq(bomVersions.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: `BOM version ${versionNo} created.`, bomVersion: row });
});

router.get('/boms/:versionId', authenticate, async (req, res) => {
  const versionId = Number(req.params.versionId);
  const [version] = await db.select().from(bomVersions).where(eq(bomVersions.id, versionId)).limit(1);
  if (!version) return res.status(404).json({ message: 'BOM version not found.' });

  const items = await db
    .select({
      id: bomItems.id,
      materialId: bomItems.materialId,
      materialCode: testMaterials.materialCode,
      materialName: bomItems.materialName,
      category: bomItems.category,
      unit: bomItems.unit,
      consumption: bomItems.consumption,
      wastagePct: bomItems.wastagePct,
      colorDependent: bomItems.colorDependent,
      sizeDependent: bomItems.sizeDependent,
      preferredSupplierId: bomItems.preferredSupplierId,
      preferredSupplierName: suppliers.supplierName,
      remarks: bomItems.remarks,
    })
    .from(bomItems)
    .leftJoin(testMaterials, eq(bomItems.materialId, testMaterials.id))
    .leftJoin(suppliers, eq(bomItems.preferredSupplierId, suppliers.id))
    .where(eq(bomItems.bomVersionId, versionId));

  return res.json({ bomVersion: version, items });
});

router.put('/boms/:versionId/status', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const versionId = Number(req.params.versionId);
  const { status } = req.body || {};
  if (!status || !BOM_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${BOM_STATUSES.join(', ')}.` });
  }
  const [version] = await db.select({ id: bomVersions.id, styleId: bomVersions.styleId }).from(bomVersions).where(eq(bomVersions.id, versionId)).limit(1);
  if (!version) return res.status(404).json({ message: 'BOM version not found.' });

  await db.transaction(async (tx) => {
    if (status === 'Active') {
      await tx.update(bomVersions).set({ status: 'Superseded' }).where(eq(bomVersions.styleId, version.styleId));
    }
    await tx.update(bomVersions).set({ status }).where(eq(bomVersions.id, versionId));
  });

  const [row] = await db.select().from(bomVersions).where(eq(bomVersions.id, versionId)).limit(1);
  return res.json({ message: `BOM version marked ${status}.`, bomVersion: row });
});

/* ------------------------------ BOM items ---------------------------- */

router.post('/boms/:versionId/items', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const versionId = Number(req.params.versionId);
  const [version] = await db.select({ id: bomVersions.id }).from(bomVersions).where(eq(bomVersions.id, versionId)).limit(1);
  if (!version) return res.status(404).json({ message: 'BOM version not found.' });

  const {
    materialId, materialName, category, unit,
    consumption, wastagePct, colorDependent, sizeDependent, preferredSupplierId, remarks,
  } = req.body || {};

  if (!materialId && !materialName) {
    return res.status(400).json({ message: 'materialId or materialName is required.' });
  }
  if (consumption === undefined || consumption === '') {
    return res.status(400).json({ message: 'consumption is required.' });
  }

  // If a material is referenced, pull its name/category/unit as defaults.
  let resolved = {};
  if (materialId) {
    const [mat] = await db.select().from(testMaterials).where(eq(testMaterials.id, Number(materialId))).limit(1);
    if (!mat) return res.status(400).json({ message: 'Material not found.' });
    resolved = {
      materialId: mat.id,
      materialName: mat.materialName,
      category: mat.category,
      unit: mat.unit,
    };
  }

  const [inserted] = await db.insert(bomItems).values({
    bomVersionId: versionId,
    materialId: resolved.materialId || null,
    materialName: resolved.materialName || materialName || null,
    category: resolved.category || category || null,
    unit: resolved.unit || unit || null,
    consumption: String(consumption),
    wastagePct: wastagePct !== undefined && wastagePct !== '' ? String(wastagePct) : '0',
    colorDependent: Boolean(colorDependent),
    sizeDependent: Boolean(sizeDependent),
    preferredSupplierId: preferredSupplierId ? Number(preferredSupplierId) : null,
    remarks: remarks || null,
  });
  const [row] = await db.select().from(bomItems).where(eq(bomItems.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'BOM item added.', item: row });
});

router.put('/boms/:versionId/items/:itemId', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const itemId = Number(req.params.itemId);
  const [existing] = await db.select().from(bomItems).where(eq(bomItems.id, itemId)).limit(1);
  if (!existing) return res.status(404).json({ message: 'BOM item not found.' });

  const { consumption, wastagePct, colorDependent, sizeDependent, preferredSupplierId, remarks, materialId } = req.body || {};
  await db.update(bomItems).set({
    ...(materialId !== undefined ? { materialId: materialId ? Number(materialId) : null } : {}),
    ...(consumption !== undefined && consumption !== '' ? { consumption: String(consumption) } : {}),
    ...(wastagePct !== undefined ? { wastagePct: wastagePct !== '' ? String(wastagePct) : '0' } : {}),
    ...(colorDependent !== undefined ? { colorDependent: Boolean(colorDependent) } : {}),
    ...(sizeDependent !== undefined ? { sizeDependent: Boolean(sizeDependent) } : {}),
    ...(preferredSupplierId !== undefined ? { preferredSupplierId: preferredSupplierId ? Number(preferredSupplierId) : null } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  }).where(eq(bomItems.id, itemId));

  const [row] = await db.select().from(bomItems).where(eq(bomItems.id, itemId)).limit(1);
  return res.json({ message: 'BOM item updated.', item: row });
});

router.delete('/boms/:versionId/items/:itemId', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  await db.delete(bomItems).where(eq(bomItems.id, Number(req.params.itemId)));
  return res.json({ message: 'BOM item removed.' });
});

module.exports = router;
