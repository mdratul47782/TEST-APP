/**
 * Warehouse routes - stock ledger, adjustments (with approval), fabric
 * rolls and warehouse master.
 *
 *   GET    /api/stock/ledger?materialId=     transaction ledger
 *   GET    /api/stock/overview               per-material stock snapshot
 *   POST   /api/stock/adjustments            request an adjustment
 *   POST   /api/stock/adjustments/:id/approve  approve (writes ledger)
 *   POST   /api/stock/adjustments/:id/reject   reject
 *   GET    /api/stock/adjustments            list adjustments
 *   GET    /api/fabric-rolls?materialId=     list fabric rolls
 *   GET    /api/warehouses                   list warehouses
 *   POST   /api/warehouses                   create warehouse
 */
const { Router } = require('express');
const { eq, asc, desc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  stockTransactions,
  stockAdjustments,
  fabricRolls,
  testMaterials,
  materialReservations,
  warehouses,
  users,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');
const { moveStock } = require('../services/inventory');

const router = Router();

/* ------------------------------ Ledger ------------------------------- */

router.get('/ledger', authenticate, async (req, res) => {
  const { materialId } = req.query;
  let query = db
    .select({
      id: stockTransactions.id,
      materialId: stockTransactions.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      transactionType: stockTransactions.transactionType,
      qty: stockTransactions.qty,
      balanceAfter: stockTransactions.balanceAfter,
      referenceType: stockTransactions.referenceType,
      referenceId: stockTransactions.referenceId,
      remarks: stockTransactions.remarks,
      createdByName: users.name,
      createdAt: stockTransactions.createdAt,
    })
    .from(stockTransactions)
    .leftJoin(testMaterials, eq(stockTransactions.materialId, testMaterials.id))
    .leftJoin(users, eq(stockTransactions.createdBy, users.id))
    .orderBy(desc(stockTransactions.createdAt));

  if (materialId) {
    query = query.where(eq(stockTransactions.materialId, Number(materialId)));
  }
  const rows = await query;
  return res.json({ transactions: rows, total: rows.length });
});

/* ------------------------------ Overview ------------------------------ */

router.get('/overview', authenticate, async (req, res) => {
  const materials = await db
    .select({
      id: testMaterials.id,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      category: testMaterials.category,
      stockQuantity: testMaterials.stockQuantity,
      safetyStock: testMaterials.safetyStock,
      unit: testMaterials.unit,
      rackLocation: testMaterials.rackLocation,
      testStatus: testMaterials.testStatus,
    })
    .from(testMaterials)
    .orderBy(asc(testMaterials.materialCode));

  const ids = materials.map((m) => m.id);
  const reservations = ids.length
    ? await db
        .select({ materialId: materialReservations.materialId, qty: materialReservations.qty })
        .from(materialReservations)
        .where(inArray(materialReservations.materialId, ids))
        .where(eq(materialReservations.status, 'Active'))
    : [];

  const reserved = new Map();
  for (const r of reservations) reserved.set(r.materialId, (reserved.get(r.materialId) || 0) + Number(r.qty));

  const rows = materials.map((m) => {
    const physical = Number(m.stockQuantity);
    const reservedQty = reserved.get(m.id) || 0;
    return {
      ...m,
      physical,
      reserved: Math.round(reservedQty * 1000) / 1000,
      available: Math.round((physical - reservedQty) * 1000) / 1000,
      lowStock: physical - reservedQty <= Number(m.safetyStock || 0),
    };
  });
  return res.json({ materials: rows, total: rows.length });
});

/* ---------------------------- Adjustments ---------------------------- */

router.get('/adjustments', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: stockAdjustments.id,
      adjustmentNo: stockAdjustments.adjustmentNo,
      materialId: stockAdjustments.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      qty: stockAdjustments.qty,
      reason: stockAdjustments.reason,
      status: stockAdjustments.status,
      createdByName: users.name,
      createdAt: stockAdjustments.createdAt,
    })
    .from(stockAdjustments)
    .leftJoin(testMaterials, eq(stockAdjustments.materialId, testMaterials.id))
    .leftJoin(users, eq(stockAdjustments.createdBy, users.id))
    .orderBy(desc(stockAdjustments.createdAt));
  return res.json({ adjustments: rows, total: rows.length });
});

router.post('/adjustments', authenticate, authorize('Admin', 'Store_Manager'), async (req, res) => {
  const { materialId, qty, reason } = req.body || {};
  if (!materialId || qty === undefined || Number(qty) === 0 || !reason) {
    return res.status(400).json({ message: 'materialId, non-zero qty and reason are required.' });
  }
  const adjustmentNo = await nextDocNo(db, 'ADJ');
  const [inserted] = await db.insert(stockAdjustments).values({
    adjustmentNo,
    materialId: Number(materialId),
    qty: String(qty),
    reason,
    status: 'Pending',
    createdBy: req.user.id,
  });
  const [row] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: `Adjustment ${adjustmentNo} requested for approval.`, adjustment: row });
});

router.post('/adjustments/:id/approve', authenticate, authorize('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  const [adj] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.id, id)).limit(1);
  if (!adj) return res.status(404).json({ message: 'Adjustment not found.' });
  if (adj.status !== 'Pending') return res.status(409).json({ message: 'Adjustment already processed.' });

  await db.transaction(async (tx) => {
    const qty = Number(adj.qty);
    const type = qty > 0 ? 'Adjustment_In' : 'Adjustment_Out';
    await moveStock(tx, {
      materialId: adj.materialId,
      transactionType: type,
      qty,
      referenceType: 'ADJUSTMENT',
      referenceId: adj.id,
      remarks: adj.reason,
      userId: req.user.id,
    });
    await tx.update(stockAdjustments).set({ status: 'Approved', approvedBy: req.user.id }).where(eq(stockAdjustments.id, id));
  });
  return res.json({ message: `Adjustment ${adj.adjustmentNo} approved. Stock updated.` });
});

router.post('/adjustments/:id/reject', authenticate, authorize('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  await db.update(stockAdjustments).set({ status: 'Rejected' }).where(eq(stockAdjustments.id, id));
  return res.json({ message: 'Adjustment rejected.' });
});

/* ---------------------------- Fabric rolls --------------------------- */

router.get('/fabric-rolls', authenticate, async (req, res) => {
  const { materialId } = req.query;
  let query = db
    .select({
      id: fabricRolls.id,
      materialId: fabricRolls.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      rollNo: fabricRolls.rollNo,
      length: fabricRolls.length,
      width: fabricRolls.width,
      shade: fabricRolls.shade,
      batch: fabricRolls.batch,
      lot: fabricRolls.lot,
      gsm: fabricRolls.gsm,
      remainingLength: fabricRolls.remainingLength,
      status: fabricRolls.status,
    })
    .from(fabricRolls)
    .leftJoin(testMaterials, eq(fabricRolls.materialId, testMaterials.id))
    .orderBy(desc(fabricRolls.createdAt));
  if (materialId) query = query.where(eq(fabricRolls.materialId, Number(materialId)));
  const rows = await query;
  return res.json({ rolls: rows, total: rows.length });
});

/* ----------------------------- Warehouses ---------------------------- */

router.get('/warehouses', authenticate, async (req, res) => {
  const rows = await db.select().from(warehouses).orderBy(asc(warehouses.warehouseName));
  return res.json({ warehouses: rows });
});

router.post('/warehouses', authenticate, authorize('Admin'), async (req, res) => {
  const { warehouseCode, warehouseName, location } = req.body || {};
  if (!warehouseCode || !warehouseName) {
    return res.status(400).json({ message: 'warehouseCode and warehouseName are required.' });
  }
  const [inserted] = await db.insert(warehouses).values({ warehouseCode, warehouseName, location: location || null });
  const [row] = await db.select().from(warehouses).where(eq(warehouses.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Warehouse created.', warehouse: row });
});

module.exports = router;
