/**
 * Purchase order routes - CRUD + PR conversion.
 *
 *   GET  /api/purchase-orders             list POs (+supplier, receive progress)
 *   GET  /api/purchase-orders/:id         detail with items + GRNs
 *   POST /api/purchase-orders             create PO (optionally from PR)
 *   POST /api/purchase-orders/from-pr/:prId  convert an approved PR to a PO
 *   POST /api/purchase-orders/:id/status  status transition
 */
const { Router } = require('express');
const { eq, asc, desc, inArray, and } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  purchaseOrders,
  purchaseOrderItems,
  purchaseRequisitions,
  purchaseRequisitionItems,
  suppliers,
  supplierMaterials,
  testMaterials,
  goodsReceipts,
  PO_STATUSES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');

const router = Router();

async function hydrateItems(poId) {
  return db
    .select({
      id: purchaseOrderItems.id,
      materialId: purchaseOrderItems.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      unit: testMaterials.unit,
      qty: purchaseOrderItems.qty,
      unitPrice: purchaseOrderItems.unitPrice,
      receivedQty: purchaseOrderItems.receivedQty,
      cancelledQty: purchaseOrderItems.cancelledQty,
    })
    .from(purchaseOrderItems)
    .leftJoin(testMaterials, eq(purchaseOrderItems.materialId, testMaterials.id))
    .where(eq(purchaseOrderItems.poId, poId))
    .orderBy(asc(purchaseOrderItems.id));
}

async function derivePoStatus(tx, poId) {
  const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
  const allReceived = items.length > 0 && items.every((i) => Number(i.receivedQty) >= Number(i.qty) || Number(i.cancelledQty) >= Number(i.qty));
  const anyReceived = items.some((i) => Number(i.receivedQty) > 0);
  const status = allReceived ? 'Received' : anyReceived ? 'Partially_Received' : 'Approved';
  await tx.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, poId));
  return status;
}

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.supplierName,
      prId: purchaseOrders.prId,
      orderDate: purchaseOrders.orderDate,
      deliveryDate: purchaseOrders.deliveryDate,
      status: purchaseOrders.status,
      currency: purchaseOrders.currency,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .orderBy(desc(purchaseOrders.createdAt));

  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db
        .select({
          poId: purchaseOrderItems.poId,
          qty: purchaseOrderItems.qty,
          receivedQty: purchaseOrderItems.receivedQty,
          cancelledQty: purchaseOrderItems.cancelledQty,
        })
        .from(purchaseOrderItems)
        .where(inArray(purchaseOrderItems.poId, ids))
    : [];

  const progress = new Map();
  for (const i of items) {
    const p = progress.get(i.poId) || { total: 0, received: 0 };
    p.total += Number(i.qty);
    p.received += Number(i.receivedQty);
    progress.set(i.poId, p);
  }

  const list = rows.map((r) => {
    const p = progress.get(r.id) || { total: 0, received: 0 };
    return {
      ...r,
      totalQty: Math.round(p.total * 100) / 100,
      receivedQty: Math.round(p.received * 100) / 100,
      remainingQty: Math.round((p.total - p.received) * 100) / 100,
    };
  });
  return res.json({ purchaseOrders: list, total: list.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.supplierName,
      prId: purchaseOrders.prId,
      orderDate: purchaseOrders.orderDate,
      deliveryDate: purchaseOrders.deliveryDate,
      status: purchaseOrders.status,
      currency: purchaseOrders.currency,
      remarks: purchaseOrders.remarks,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!po) return res.status(404).json({ message: 'Purchase order not found.' });

  const items = await hydrateItems(id);
  const grns = await db
    .select()
    .from(goodsReceipts)
    .where(eq(goodsReceipts.poId, id))
    .orderBy(desc(goodsReceipts.createdAt));
  return res.json({ purchaseOrder: po, items, grns });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Procurement'), async (req, res) => {
  const { supplierId, prId, deliveryDate, currency, remarks, items } = req.body || {};
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'supplierId and at least one item are required.' });
  }
  for (const it of items) {
    if (!it.materialId || it.qty === undefined || Number(it.qty) <= 0) {
      return res.status(400).json({ message: 'Each item needs materialId and qty > 0.' });
    }
  }

  const poNo = await nextDocNo(db, 'PO');
  const [inserted] = await db.insert(purchaseOrders).values({
    poNo,
    supplierId: Number(supplierId),
    prId: prId ? Number(prId) : null,
    orderDate: new Date().toISOString().slice(0, 10),
    deliveryDate: deliveryDate || null,
    status: 'Draft',
    currency: currency || 'USD',
    remarks: remarks || null,
    createdBy: req.user.id,
  });
  const poId = inserted.insertId;

  await db.transaction(async (tx) => {
    for (const it of items) {
      await tx.insert(purchaseOrderItems).values({
        poId,
        materialId: Number(it.materialId),
        qty: String(it.qty),
        unitPrice: it.unitPrice !== undefined && it.unitPrice !== '' ? String(it.unitPrice) : null,
      });
    }
    await derivePoStatus(tx, poId);
  });

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  const hydrated = await hydrateItems(poId);
  return res.status(201).json({ message: `${poNo} created.`, purchaseOrder: po, items: hydrated });
});

/* ------------------------- Convert approved PR ----------------------- */

router.post('/from-pr/:prId', authenticate, authorize('Admin', 'Procurement'), async (req, res) => {
  const prId = Number(req.params.prId);
  const { supplierId, deliveryDate, currency, remarks } = req.body || {};
  if (!supplierId) return res.status(400).json({ message: 'supplierId is required.' });

  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, prId)).limit(1);
  if (!pr) return res.status(404).json({ message: 'Requisition not found.' });
  if (pr.status === 'Converted') return res.status(409).json({ message: 'Requisition already converted.' });
  if (pr.status !== 'Approved') {
    return res.status(400).json({ message: 'Only an APPROVED requisition can be converted to a purchase order.' });
  }

  const prItems = await db
    .select()
    .from(purchaseRequisitionItems)
    .where(eq(purchaseRequisitionItems.prId, prId));

  const poNo = await nextDocNo(db, 'PO');
  const [inserted] = await db.insert(purchaseOrders).values({
    poNo,
    supplierId: Number(supplierId),
    prId,
    orderDate: new Date().toISOString().slice(0, 10),
    deliveryDate: deliveryDate || pr.requiredDate || null,
    status: 'Draft',
    currency: currency || 'USD',
    remarks: remarks || `Converted from ${pr.prNo}.`,
    createdBy: req.user.id,
  });
  const poId = inserted.insertId;

  await db.transaction(async (tx) => {
    for (const it of prItems) {
      // Default price from the supplier-material link if available.
      const [sm] = await tx
        .select({
          unitPrice: supplierMaterials.unitPrice,
          moq: supplierMaterials.moq,
        })
        .from(supplierMaterials)
        .where(
          and(
            eq(supplierMaterials.supplierId, Number(supplierId)),
            eq(supplierMaterials.materialId, it.materialId)
          )
        )
        .limit(1);
      await tx.insert(purchaseOrderItems).values({
        poId,
        materialId: it.materialId,
        qty: String(it.qty),
        unitPrice: sm?.unitPrice != null ? String(sm.unitPrice) : null,
      });
    }
    await derivePoStatus(tx, poId);
    await tx.update(purchaseRequisitions).set({ status: 'Converted' }).where(eq(purchaseRequisitions.id, prId));
  });

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  const hydrated = await hydrateItems(poId);
  return res.status(201).json({ message: `${poNo} created from ${pr.prNo}.`, purchaseOrder: po, items: hydrated });
});

/* --------------------------- Status transition ----------------------- */

router.post('/:id/status', authenticate, authorize('Admin', 'Procurement'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !PO_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${PO_STATUSES.join(', ')}.` });
  }
  const [po] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  if (!po) return res.status(404).json({ message: 'Purchase order not found.' });
  await db.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, id));
  const [updated] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return res.json({ message: `PO ${updated.poNo} is now ${status}.`, purchaseOrder: updated });
});

module.exports = router;
