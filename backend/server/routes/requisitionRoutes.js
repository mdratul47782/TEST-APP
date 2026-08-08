/**
 * Purchase requisition routes - MRP-driven creation + approval workflow.
 *
 *   GET  /api/requisitions               list PRs (+material names, status)
 *   GET  /api/requisitions/:id           detail with items
 *   POST /api/requisitions               create PR manually
 *   POST /api/requisitions/from-mrp/:orderId  generate PR from MRP shortage
 *   POST /api/requisitions/:id/status    transition (submit/approve/reject)
 */
const { Router } = require('express');
const { eq, asc, desc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  purchaseRequisitions,
  purchaseRequisitionItems,
  salesOrders,
  testMaterials,
  PR_STATUSES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');
const { computeOrderMrp, round } = require('../services/mrp');

const router = Router();

async function hydrateItems(prId) {
  return db
    .select({
      id: purchaseRequisitionItems.id,
      materialId: purchaseRequisitionItems.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      unit: testMaterials.unit,
      qty: purchaseRequisitionItems.qty,
      reason: purchaseRequisitionItems.reason,
      requiredDate: purchaseRequisitionItems.requiredDate,
    })
    .from(purchaseRequisitionItems)
    .leftJoin(testMaterials, eq(purchaseRequisitionItems.materialId, testMaterials.id))
    .where(eq(purchaseRequisitionItems.prId, prId))
    .orderBy(asc(purchaseRequisitionItems.id));
}

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: purchaseRequisitions.id,
      prNo: purchaseRequisitions.prNo,
      orderId: purchaseRequisitions.orderId,
      orderNo: salesOrders.orderNo,
      status: purchaseRequisitions.status,
      requiredDate: purchaseRequisitions.requiredDate,
      remarks: purchaseRequisitions.remarks,
      createdAt: purchaseRequisitions.createdAt,
    })
    .from(purchaseRequisitions)
    .leftJoin(salesOrders, eq(purchaseRequisitions.orderId, salesOrders.id))
    .orderBy(desc(purchaseRequisitions.createdAt));

  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db
        .select({ prId: purchaseRequisitionItems.prId, qty: purchaseRequisitionItems.qty })
        .from(purchaseRequisitionItems)
        .where(inArray(purchaseRequisitionItems.prId, ids))
    : [];
  const itemCount = new Map();
  for (const i of items) itemCount.set(i.prId, (itemCount.get(i.prId) || 0) + 1);

  const list = rows.map((r) => ({ ...r, itemCount: itemCount.get(r.id) || 0 }));
  return res.json({ requisitions: list, total: list.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, id)).limit(1);
  if (!pr) return res.status(404).json({ message: 'Requisition not found.' });
  const items = await hydrateItems(id);
  return res.json({ requisition: pr, items });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Merchandiser', 'Procurement', 'Store_Manager'), async (req, res) => {
  const { orderId, requiredDate, remarks, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one requisition item is required.' });
  }
  for (const it of items) {
    if (!it.materialId || it.qty === undefined || Number(it.qty) <= 0) {
      return res.status(400).json({ message: 'Each item needs materialId and qty > 0.' });
    }
  }

  const prNo = await nextDocNo(db, 'PR');
  const [inserted] = await db.insert(purchaseRequisitions).values({
    prNo,
    orderId: orderId ? Number(orderId) : null,
    status: 'Draft',
    requiredDate: requiredDate || null,
    remarks: remarks || null,
    createdBy: req.user.id,
  });
  const prId = inserted.insertId;

  for (const it of items) {
    await db.insert(purchaseRequisitionItems).values({
      prId,
      materialId: Number(it.materialId),
      qty: String(it.qty),
      reason: it.reason || null,
      requiredDate: it.requiredDate || requiredDate || null,
    });
  }

  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, prId)).limit(1);
  const hydrated = await hydrateItems(prId);
  return res.status(201).json({ message: `${prNo} created.`, requisition: pr, items: hydrated });
});

/* ----------------------- Generate from MRP shortage ------------------ */

router.post('/from-mrp/:orderId', authenticate, authorize('Admin', 'Merchandiser', 'Procurement'), async (req, res) => {
  const orderId = Number(req.params.orderId);
  const { requirements } = await computeOrderMrp(orderId, { persist: false });
  const shortageItems = requirements.filter((r) => r.shortage > 0);
  if (shortageItems.length === 0) {
    return res.status(400).json({ message: 'No shortage - nothing to requisition.' });
  }

  const prNo = await nextDocNo(db, 'PR');
  const requiredDate = req.body?.requiredDate || null;

  const [inserted] = await db.insert(purchaseRequisitions).values({
    prNo,
    orderId,
    status: 'Draft',
    requiredDate: requiredDate || null,
    remarks: `Auto-generated from MRP (order ${orderId}).`,
    createdBy: req.user.id,
  });
  const prId = inserted.insertId;

  for (const r of shortageItems) {
    await db.insert(purchaseRequisitionItems).values({
      prId,
      materialId: r.materialId,
      qty: String(r.suggestedQty),
      reason: `MRP shortage: required ${r.netQty} ${r.unit}, available ${r.available}, incoming ${r.incoming}`,
      requiredDate: requiredDate || null,
    });
  }

  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, prId)).limit(1);
  const hydrated = await hydrateItems(prId);
  return res.status(201).json({
    message: `${prNo} created from MRP with ${shortageItems.length} shortage line(s).`,
    requisition: pr,
    items: hydrated,
  });
});

/* --------------------------- Status transition ----------------------- */

router.post('/:id/status', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !PR_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${PR_STATUSES.join(', ')}.` });
  }
  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, id)).limit(1);
  if (!pr) return res.status(404).json({ message: 'Requisition not found.' });

  // Approval gate: Admin or Procurement approves/rejects.
  if (status === 'Approved' || status === 'Rejected') {
    if (!['Admin', 'Procurement'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Admin or Procurement can approve/reject requisitions.' });
    }
  }

  await db.update(purchaseRequisitions).set({ status }).where(eq(purchaseRequisitions.id, id));
  const [updated] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, id)).limit(1);
  return res.json({ message: `Requisition ${updated.prNo} is now ${status}.`, requisition: updated });
});

module.exports = router;
