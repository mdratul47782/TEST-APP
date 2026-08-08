/**
 * Cutting routes - cutting plans (marker/lay), plan items (consumption vs
 * actual) and bundles.
 *
 *   GET  /api/cutting                    list plans
 *   GET  /api/cutting/:id                detail with items + bundles
 *   POST /api/cutting                    create plan (+ items)
 *   POST /api/cutting/:id/items          add plan item
 *   PUT  /api/cutting/:id/items/:itemId  record actual consumption
 *   POST /api/cutting/:id/bundles        add bundle
 *   POST /api/cutting/:id/status         transition plan status
 */
const { Router } = require('express');
const { eq, asc, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  cuttingPlans,
  cuttingPlanItems,
  cuttingBundles,
  productionOrders,
  testMaterials,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');

const router = Router();

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: cuttingPlans.id,
      cuttingPlanNo: cuttingPlans.cuttingPlanNo,
      productionOrderId: cuttingPlans.productionOrderId,
      productionOrderNo: productionOrders.productionOrderNo,
      markerNo: cuttingPlans.markerNo,
      layNo: cuttingPlans.layNo,
      cutQty: cuttingPlans.cutQty,
      status: cuttingPlans.status,
      plannedDate: cuttingPlans.plannedDate,
      createdAt: cuttingPlans.createdAt,
    })
    .from(cuttingPlans)
    .leftJoin(productionOrders, eq(cuttingPlans.productionOrderId, productionOrders.id))
    .orderBy(desc(cuttingPlans.createdAt));
  return res.json({ cuttingPlans: rows, total: rows.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [plan] = await db.select().from(cuttingPlans).where(eq(cuttingPlans.id, id)).limit(1);
  if (!plan) return res.status(404).json({ message: 'Cutting plan not found.' });
  const items = await db
    .select({
      id: cuttingPlanItems.id,
      materialId: cuttingPlanItems.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      plannedConsumption: cuttingPlanItems.plannedConsumption,
      actualConsumption: cuttingPlanItems.actualConsumption,
      wastageQty: cuttingPlanItems.wastageQty,
      shortageQty: cuttingPlanItems.shortageQty,
      excessQty: cuttingPlanItems.excessQty,
    })
    .from(cuttingPlanItems)
    .leftJoin(testMaterials, eq(cuttingPlanItems.materialId, testMaterials.id))
    .where(eq(cuttingPlanItems.cuttingPlanId, id));
  const bundles = await db.select().from(cuttingBundles).where(eq(cuttingBundles.cuttingPlanId, id));
  return res.json({ plan, items, bundles });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Production_Manager', 'Store_Manager'), async (req, res) => {
  const { productionOrderId, markerNo, layNo, cutQty, plannedDate, remarks, items } = req.body || {};
  if (!productionOrderId) return res.status(400).json({ message: 'productionOrderId is required.' });

  const cuttingPlanNo = await nextDocNo(db, 'CP');
  const [inserted] = await db.insert(cuttingPlans).values({
    cuttingPlanNo,
    productionOrderId: Number(productionOrderId),
    markerNo: markerNo || null,
    layNo: layNo || null,
    cutQty: cutQty ? Number(cutQty) : null,
    status: 'Planned',
    plannedDate: plannedDate || null,
    remarks: remarks || null,
  });
  const planId = inserted.insertId;

  for (const it of items || []) {
    if (!it.materialId || it.plannedConsumption === undefined) continue;
    await db.insert(cuttingPlanItems).values({
      cuttingPlanId: planId,
      materialId: Number(it.materialId),
      plannedConsumption: String(it.plannedConsumption),
      actualConsumption: it.actualConsumption !== undefined && it.actualConsumption !== '' ? String(it.actualConsumption) : null,
      wastageQty: it.wastageQty !== undefined && it.wastageQty !== '' ? String(it.wastageQty) : '0',
      shortageQty: '0',
      excessQty: '0',
    });
  }

  const [plan] = await db.select().from(cuttingPlans).where(eq(cuttingPlans.id, planId)).limit(1);
  return res.status(201).json({ message: `${cuttingPlanNo} created.`, plan });
});

/* ------------------------------ Plan items --------------------------- */

router.post('/:id/items', authenticate, authorize('Admin', 'Production_Manager'), async (req, res) => {
  const planId = Number(req.params.id);
  const { materialId, plannedConsumption, actualConsumption, wastageQty } = req.body || {};
  if (!materialId || plannedConsumption === undefined) {
    return res.status(400).json({ message: 'materialId and plannedConsumption are required.' });
  }
  const [inserted] = await db.insert(cuttingPlanItems).values({
    cuttingPlanId: planId,
    materialId: Number(materialId),
    plannedConsumption: String(plannedConsumption),
    actualConsumption: actualConsumption !== undefined && actualConsumption !== '' ? String(actualConsumption) : null,
    wastageQty: wastageQty !== undefined && wastageQty !== '' ? String(wastageQty) : '0',
    shortageQty: '0',
    excessQty: '0',
  });
  const [row] = await db.select().from(cuttingPlanItems).where(eq(cuttingPlanItems.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Plan item added.', item: row });
});

router.put('/:id/items/:itemId', authenticate, authorize('Admin', 'Production_Manager'), async (req, res) => {
  const itemId = Number(req.params.itemId);
  const { actualConsumption, wastageQty } = req.body || {};
  const [existing] = await db.select().from(cuttingPlanItems).where(eq(cuttingPlanItems.id, itemId)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Plan item not found.' });

  const actual = actualConsumption !== undefined && actualConsumption !== '' ? Number(actualConsumption) : Number(existing.actualConsumption || 0);
  const planned = Number(existing.plannedConsumption);
  await db.update(cuttingPlanItems).set({
    ...(actualConsumption !== undefined ? { actualConsumption: actualConsumption !== '' ? String(actualConsumption) : null } : {}),
    ...(wastageQty !== undefined ? { wastageQty: wastageQty !== '' ? String(wastageQty) : String(Math.max(0, planned - actual)) } : {}),
    shortageQty: String(Math.max(0, planned - actual)),
    excessQty: String(Math.max(0, actual - planned)),
  }).where(eq(cuttingPlanItems.id, itemId));

  const [row] = await db.select().from(cuttingPlanItems).where(eq(cuttingPlanItems.id, itemId)).limit(1);
  return res.json({ message: 'Plan item updated.', item: row });
});

/* ------------------------------ Bundles ------------------------------ */

router.post('/:id/bundles', authenticate, authorize('Admin', 'Production_Manager'), async (req, res) => {
  const planId = Number(req.params.id);
  const { bundleNo, size, color, panelCount, qty } = req.body || {};
  if (!bundleNo || !qty) return res.status(400).json({ message: 'bundleNo and qty are required.' });
  const [inserted] = await db.insert(cuttingBundles).values({
    cuttingPlanId: planId,
    bundleNo,
    size: size || null,
    color: color || null,
    panelCount: panelCount ? Number(panelCount) : null,
    qty: Number(qty),
  });
  const [row] = await db.select().from(cuttingBundles).where(eq(cuttingBundles.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Bundle added.', bundle: row });
});

/* --------------------------- Status transition ----------------------- */

router.post('/:id/status', authenticate, authorize('Admin', 'Production_Manager'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !['Planned', 'In_Progress', 'Completed'].includes(status)) {
    return res.status(400).json({ message: 'status must be Planned, In_Progress or Completed.' });
  }
  await db.update(cuttingPlans).set({ status }).where(eq(cuttingPlans.id, id));
  const [plan] = await db.select().from(cuttingPlans).where(eq(cuttingPlans.id, id)).limit(1);
  return res.json({ message: `Cutting plan ${plan.cuttingPlanNo} is now ${status}.`, plan });
});

module.exports = router;
