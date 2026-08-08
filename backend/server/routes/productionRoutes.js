/**
 * Production routes - production orders + stage output tracking (WIP).
 *
 *   GET    /api/production                   list production orders (with WIP)
 *   GET    /api/production/:id               detail with output history
 *   POST   /api/production                   create production order (from order line)
 *   POST   /api/production/:id/status        stage transition
 *   POST   /api/production/:id/output        record stage output (input/output qty)
 *   GET    /api/production/delayed           orders delayed by material shortage
 */
const { Router } = require('express');
const { eq, asc, desc, and, ne, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  productionOrders,
  productionOutput,
  salesOrderLines,
  salesOrders,
  styles,
  testMaterials,
  materialReservations,
  PRODUCTION_STATUSES,
  OUTPUT_STAGES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');
const { computeOrderMrp } = require('../services/mrp');

const router = Router();

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: productionOrders.id,
      productionOrderNo: productionOrders.productionOrderNo,
      salesOrderLineId: productionOrders.salesOrderLineId,
      orderNo: salesOrders.orderNo,
      styleId: productionOrders.styleId,
      styleNumber: styles.styleNumber,
      productName: styles.productName,
      qty: productionOrders.qty,
      status: productionOrders.status,
      line: productionOrders.line,
      plannedStart: productionOrders.plannedStart,
      plannedEnd: productionOrders.plannedEnd,
      createdAt: productionOrders.createdAt,
    })
    .from(productionOrders)
    .leftJoin(salesOrderLines, eq(productionOrders.salesOrderLineId, salesOrderLines.id))
    .leftJoin(salesOrders, eq(salesOrderLines.orderId, salesOrders.id))
    .leftJoin(styles, eq(productionOrders.styleId, styles.id))
    .orderBy(desc(productionOrders.createdAt));

  const ids = rows.map((r) => r.id);
  const outputs = ids.length
    ? await db
        .select({ productionOrderId: productionOutput.productionOrderId, stage: productionOutput.stage, qty: productionOutput.qty, rejectionQty: productionOutput.rejectionQty })
        .from(productionOutput)
        .where(inArray(productionOutput.productionOrderId, ids))
    : [];

  const byOrder = new Map();
  for (const o of outputs) {
    if (!byOrder.has(o.productionOrderId)) byOrder.set(o.productionOrderId, { finishingOut: 0, rejection: 0 });
    const rec = byOrder.get(o.productionOrderId);
    if (o.stage === 'Finishing_Output') rec.finishingOut += o.qty;
    rec.rejection += o.rejectionQty;
  }

  const list = rows.map((r) => {
    const rec = byOrder.get(r.id) || { finishingOut: 0, rejection: 0 };
    return { ...r, produced: rec.finishingOut, wip: Math.max(0, r.qty - rec.finishingOut), rejection: rec.rejection };
  });
  return res.json({ productionOrders: list, total: list.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [po] = await db
    .select({
      id: productionOrders.id,
      productionOrderNo: productionOrders.productionOrderNo,
      salesOrderLineId: productionOrders.salesOrderLineId,
      orderId: salesOrders.id,
      orderNo: salesOrders.orderNo,
      styleId: productionOrders.styleId,
      styleNumber: styles.styleNumber,
      productName: styles.productName,
      qty: productionOrders.qty,
      status: productionOrders.status,
      line: productionOrders.line,
      plannedStart: productionOrders.plannedStart,
      plannedEnd: productionOrders.plannedEnd,
      remarks: productionOrders.remarks,
      createdAt: productionOrders.createdAt,
    })
    .from(productionOrders)
    .leftJoin(salesOrderLines, eq(productionOrders.salesOrderLineId, salesOrderLines.id))
    .leftJoin(salesOrders, eq(salesOrderLines.orderId, salesOrders.id))
    .leftJoin(styles, eq(productionOrders.styleId, styles.id))
    .where(eq(productionOrders.id, id))
    .limit(1);
  if (!po) return res.status(404).json({ message: 'Production order not found.' });

  const output = await db
    .select()
    .from(productionOutput)
    .where(eq(productionOutput.productionOrderId, id))
    .orderBy(asc(productionOutput.recordedAt));

  const finishingOut = output.filter((o) => o.stage === 'Finishing_Output').reduce((s, o) => s + o.qty, 0);
  return res.json({ productionOrder: po, output, produced: finishingOut, wip: Math.max(0, po.qty - finishingOut) });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Production_Manager', 'Merchandiser'), async (req, res) => {
  const { salesOrderLineId, qty, line, plannedStart, plannedEnd, remarks } = req.body || {};
  if (!salesOrderLineId || !qty || Number(qty) <= 0) {
    return res.status(400).json({ message: 'salesOrderLineId and qty > 0 are required.' });
  }
  const [orderLine] = await db
    .select({
      id: salesOrderLines.id,
      styleId: salesOrderLines.styleId,
      orderId: salesOrderLines.orderId,
      quantity: salesOrderLines.quantity,
    })
    .from(salesOrderLines)
    .where(eq(salesOrderLines.id, Number(salesOrderLineId)))
    .limit(1);
  if (!orderLine) return res.status(404).json({ message: 'Order line not found.' });
  if (Number(qty) > orderLine.quantity) {
    return res.status(400).json({ message: `Production qty cannot exceed line qty (${orderLine.quantity}).` });
  }

  const productionOrderNo = await nextDocNo(db, 'PROD');
  const [inserted] = await db.insert(productionOrders).values({
    productionOrderNo,
    salesOrderLineId: orderLine.id,
    styleId: orderLine.styleId,
    qty: Number(qty),
    status: 'Planned',
    line: line || null,
    plannedStart: plannedStart || null,
    plannedEnd: plannedEnd || null,
    remarks: remarks || null,
  });
  const [row] = await db.select().from(productionOrders).where(eq(productionOrders.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: `${productionOrderNo} created.`, productionOrder: row });
});

/* --------------------------- Status transition ----------------------- */

router.post('/:id/status', authenticate, authorize('Admin', 'Production_Manager'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !PRODUCTION_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${PRODUCTION_STATUSES.join(', ')}.` });
  }
  const [po] = await db.select({ id: productionOrders.id }).from(productionOrders).where(eq(productionOrders.id, id)).limit(1);
  if (!po) return res.status(404).json({ message: 'Production order not found.' });
  await db.update(productionOrders).set({ status }).where(eq(productionOrders.id, id));
  const [updated] = await db.select().from(productionOrders).where(eq(productionOrders.id, id)).limit(1);
  return res.json({ message: `Production order moved to ${status}.`, productionOrder: updated });
});

/* --------------------------- Stage output ---------------------------- */

router.post('/:id/output', authenticate, authorize('Admin', 'Production_Manager'), async (req, res) => {
  const id = Number(req.params.id);
  const { stage, qty, rejectionQty, remarks } = req.body || {};
  if (!stage || !OUTPUT_STAGES.includes(stage) || !qty || Number(qty) < 0) {
    return res.status(400).json({ message: `stage must be one of ${OUTPUT_STAGES.join(', ')} and qty >= 0.` });
  }
  const [po] = await db.select({ id: productionOrders.id, qty: productionOrders.qty }).from(productionOrders).where(eq(productionOrders.id, id)).limit(1);
  if (!po) return res.status(404).json({ message: 'Production order not found.' });

  await db.insert(productionOutput).values({
    productionOrderId: id,
    stage,
    qty: Number(qty),
    rejectionQty: Number(rejectionQty) || 0,
    operatorId: req.user.id,
    remarks: remarks || null,
  });
  return res.status(201).json({ message: `${stage} recorded.` });
});

/* --------------------- Delayed by material shortage ------------------ */

router.get('/delayed', authenticate, async (req, res) => {
  // Production orders whose order still has MRP shortage and a passing/near delivery date.
  const orders = await db
    .select({
      id: productionOrders.id,
      productionOrderNo: productionOrders.productionOrderNo,
      orderId: salesOrders.id,
      orderNo: salesOrders.orderNo,
      deliveryDate: salesOrders.deliveryDate,
      status: productionOrders.status,
    })
    .from(productionOrders)
    .innerJoin(salesOrderLines, eq(productionOrders.salesOrderLineId, salesOrderLines.id))
    .innerJoin(salesOrders, eq(salesOrderLines.orderId, salesOrders.id))
    .where(and(ne(productionOrders.status, 'Completed'), ne(productionOrders.status, 'Cancelled')));

  const result = [];
  for (const o of orders) {
    const { requirements } = await computeOrderMrp(o.orderId, { persist: false });
    const shortage = requirements.reduce((s, r) => s + r.shortage, 0);
    if (shortage > 0) {
      result.push({ ...o, shortage, delayed: true });
    }
  }
  return res.json({ delayedOrders: result, total: result.length });
});

module.exports = router;
