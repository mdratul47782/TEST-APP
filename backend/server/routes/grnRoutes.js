/**
 * Goods receiving (GRN) routes - receive supplier deliveries, QC gate,
 * stock-in via the inventory ledger, optional fabric-roll creation.
 *
 *   GET  /api/grn                   list GRNs
 *   GET  /api/grn/:id               detail with items
 *   POST /api/grn                   receive against a PO (accepted → stock-in)
 *   POST /api/grn/:id/status        QC pass/fail → material test status
 */
const { Router } = require('express');
const { eq, asc, desc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  goodsReceipts,
  goodsReceiptItems,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  testMaterials,
  fabricRolls,
  warehouses,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');
const { moveStock } = require('../services/inventory');

const router = Router();

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: goodsReceipts.id,
      grnNo: goodsReceipts.grnNo,
      poId: goodsReceipts.poId,
      poNo: purchaseOrders.poNo,
      supplierId: goodsReceipts.supplierId,
      supplierName: suppliers.supplierName,
      receivedDate: goodsReceipts.receivedDate,
      invoiceNo: goodsReceipts.invoiceNo,
      status: goodsReceipts.status,
      createdAt: goodsReceipts.createdAt,
    })
    .from(goodsReceipts)
    .leftJoin(purchaseOrders, eq(goodsReceipts.poId, purchaseOrders.id))
    .leftJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
    .orderBy(desc(goodsReceipts.createdAt));
  return res.json({ grns: rows, total: rows.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [grn] = await db
    .select({
      id: goodsReceipts.id,
      grnNo: goodsReceipts.grnNo,
      poId: goodsReceipts.poId,
      poNo: purchaseOrders.poNo,
      supplierId: goodsReceipts.supplierId,
      supplierName: suppliers.supplierName,
      receivedDate: goodsReceipts.receivedDate,
      invoiceNo: goodsReceipts.invoiceNo,
      deliveryChallanNo: goodsReceipts.deliveryChallanNo,
      warehouseId: goodsReceipts.warehouseId,
      warehouseName: warehouses.warehouseName,
      status: goodsReceipts.status,
      createdAt: goodsReceipts.createdAt,
    })
    .from(goodsReceipts)
    .leftJoin(purchaseOrders, eq(goodsReceipts.poId, purchaseOrders.id))
    .leftJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
    .leftJoin(warehouses, eq(goodsReceipts.warehouseId, warehouses.id))
    .where(eq(goodsReceipts.id, id))
    .limit(1);
  if (!grn) return res.status(404).json({ message: 'GRN not found.' });

  const items = await db
    .select({
      id: goodsReceiptItems.id,
      poItemId: goodsReceiptItems.poItemId,
      materialId: goodsReceiptItems.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      unit: testMaterials.unit,
      receivedQty: goodsReceiptItems.receivedQty,
      acceptedQty: goodsReceiptItems.acceptedQty,
      rejectedQty: goodsReceiptItems.rejectedQty,
      batch: goodsReceiptItems.batch,
      lot: goodsReceiptItems.lot,
      remarks: goodsReceiptItems.remarks,
    })
    .from(goodsReceiptItems)
    .leftJoin(testMaterials, eq(goodsReceiptItems.materialId, testMaterials.id))
    .where(eq(goodsReceiptItems.grnId, id))
    .orderBy(asc(goodsReceiptItems.id));

  const rolls = await db
    .select()
    .from(fabricRolls)
    .where(inArray(fabricRolls.grnItemId, items.map((i) => i.id)));

  return res.json({ grn, items, rolls });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Store_Manager', 'Procurement'), async (req, res) => {
  const {
    poId, receivedDate, invoiceNo, deliveryChallanNo, warehouseId,
    items, rolls,
  } = req.body || {};

  if (!poId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'poId and at least one item are required.' });
  }

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, Number(poId))).limit(1);
  if (!po) return res.status(404).json({ message: 'Purchase order not found.' });

  // Validate accepted + rejected == received per line.
  for (const it of items) {
    const rec = Number(it.receivedQty);
    const acc = Number(it.acceptedQty);
    const rej = Number(it.rejectedQty) || 0;
    if (!it.materialId || rec <= 0 || acc < 0 || rej < 0) {
      return res.status(400).json({ message: 'Invalid GRN item data.' });
    }
    if (Math.abs(acc + rej - rec) > 0.0001) {
      return res.status(400).json({ message: 'acceptedQty + rejectedQty must equal receivedQty.' });
    }
  }

  const grnNo = await nextDocNo(db, 'GRN');
  let grnId;

  await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(goodsReceipts).values({
      grnNo,
      poId: Number(poId),
      supplierId: po.supplierId,
      receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
      invoiceNo: invoiceNo || null,
      deliveryChallanNo: deliveryChallanNo || null,
      warehouseId: warehouseId ? Number(warehouseId) : null,
      status: 'Pending_QC',
      createdBy: req.user.id,
    });
    grnId = inserted.insertId;

    for (const it of items) {
      // Match against a PO line for the material if present.
      const [poItem] = await tx
        .select({ id: purchaseOrderItems.id })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.poId, Number(poId)))
        .where(eq(purchaseOrderItems.materialId, Number(it.materialId)))
        .limit(1);

      const [grnItem] = await tx.insert(goodsReceiptItems).values({
        grnId,
        poItemId: poItem?.id || null,
        materialId: Number(it.materialId),
        receivedQty: String(it.receivedQty),
        acceptedQty: String(it.acceptedQty),
        rejectedQty: String(it.rejectedQty || 0),
        batch: it.batch || null,
        lot: it.lot || null,
        remarks: it.remarks || null,
      });
      const grnItemId = grnItem.insertId;

      // Stock-in for the accepted quantity only.
      if (Number(it.acceptedQty) > 0) {
        await moveStock(tx, {
          materialId: Number(it.materialId),
          transactionType: 'GRN',
          qty: Number(it.acceptedQty),
          warehouseId: warehouseId ? Number(warehouseId) : null,
          referenceType: 'GRN',
          referenceId: grnItemId,
          remarks: `GRN ${grnNo}`,
          userId: req.user.id,
        });

        // Material enters the QA pipeline.
        await tx
          .update(testMaterials)
          .set({ testStatus: 'Pending' })
          .where(eq(testMaterials.id, Number(it.materialId)));
      }

      // Fabric rolls (optional per item, keyed by materialId).
      const itemRolls = (rolls || []).filter(
        (r) => r.materialId && Number(r.materialId) === Number(it.materialId)
      );
      for (const roll of itemRolls) {
        if (!roll.rollNo || roll.length === undefined) continue;
        await tx.insert(fabricRolls).values({
          materialId: Number(it.materialId),
          grnItemId,
          rollNo: String(roll.rollNo),
          length: String(roll.length),
          width: roll.width !== undefined && roll.width !== '' ? String(roll.width) : null,
          shade: roll.shade || null,
          batch: it.batch || roll.batch || null,
          lot: it.lot || roll.lot || null,
          gsm: roll.gsm ? Number(roll.gsm) : null,
          remainingLength: String(roll.length),
        });
      }

      // Update PO item received quantity.
      if (poItem) {
        const [current] = await tx
          .select({ receivedQty: purchaseOrderItems.receivedQty })
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.id, poItem.id))
          .limit(1);
        await tx
          .update(purchaseOrderItems)
          .set({ receivedQty: String(Number(current.receivedQty) + Number(it.acceptedQty)) })
          .where(eq(purchaseOrderItems.id, poItem.id));
      }
    }

    // Recompute PO status.
    const poItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, Number(poId)));
    const allReceived = poItems.length > 0 && poItems.every((i) => Number(i.receivedQty) >= Number(i.qty));
    const anyReceived = poItems.some((i) => Number(i.receivedQty) > 0);
    await tx
      .update(purchaseOrders)
      .set({ status: allReceived ? 'Received' : anyReceived ? 'Partially_Received' : 'Approved' })
      .where(eq(purchaseOrders.id, Number(poId)));
  });

  const [grn] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, grnId)).limit(1);
  return res.status(201).json({ message: `${grnNo} recorded. Accepted stock added to warehouse.`, grn });
});

/* --------------------------- QC transition --------------------------- */

router.post('/:id/status', authenticate, authorize('Admin', 'QA_Inspector'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !['Pending_QC', 'QC_Passed', 'QC_Failed'].includes(status)) {
    return res.status(400).json({ message: 'status must be Pending_QC, QC_Passed or QC_Failed.' });
  }
  const [grn] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id)).limit(1);
  if (!grn) return res.status(404).json({ message: 'GRN not found.' });

  await db.transaction(async (tx) => {
    await tx.update(goodsReceipts).set({ status }).where(eq(goodsReceipts.id, id));

    // Reflect QC result on the involved materials.
    const items = await tx.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.grnId, id));
    for (const it of items) {
      const materialStatus = status === 'QC_Passed' ? 'Passed' : status === 'QC_Failed' ? 'Failed' : 'Pending';
      await tx
        .update(testMaterials)
        .set({ testStatus: materialStatus })
        .where(eq(testMaterials.id, it.materialId));
    }
  });

  const [updated] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id)).limit(1);
  return res.json({ message: `GRN ${updated.grnNo} marked ${status}.`, grn: updated });
});

module.exports = router;
