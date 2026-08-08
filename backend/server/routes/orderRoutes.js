/**
 * Sales order routes - booking, multi-line (color × qty × size breakdown),
 * status transitions and amendment logging.
 *
 *   GET    /api/orders                  list orders (+buyer, lines count)
 *   GET    /api/orders/:id              order detail with lines
 *   POST   /api/orders                  create order with lines (atomic)
 *   PUT    /api/orders/:id              update order header (logged as amendment)
 *   POST   /api/orders/:id/status       transition order status (logged)
 *   PUT    /api/orders/:id/lines/:lineId  update a line (qty/size/price)
 *   POST   /api/orders/:id/amendments   manual amendment entry
 *   GET    /api/orders/:id/amendments   amendment history
 */
const { Router } = require('express');
const { eq, and, asc, desc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  salesOrders,
  salesOrderLines,
  orderAmendments,
  buyers,
  styles,
  bomVersions,
  ORDER_STATUSES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');

const router = Router();

function validateLine(line) {
  if (!line.styleId || !line.color || !line.quantity) {
    return 'Every line needs styleId, color and quantity.';
  }
  if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) {
    return 'quantity must be a positive integer.';
  }
  return null;
}

async function hydrateLines(orderId) {
  const lines = await db
    .select({
      id: salesOrderLines.id,
      styleId: salesOrderLines.styleId,
      styleNumber: styles.styleNumber,
      productName: styles.productName,
      color: salesOrderLines.color,
      quantity: salesOrderLines.quantity,
      sizeBreakdown: salesOrderLines.sizeBreakdown,
      unitPrice: salesOrderLines.unitPrice,
      bomVersionId: salesOrderLines.bomVersionId,
      lineStatus: salesOrderLines.lineStatus,
    })
    .from(salesOrderLines)
    .leftJoin(styles, eq(salesOrderLines.styleId, styles.id))
    .where(eq(salesOrderLines.orderId, orderId))
    .orderBy(asc(salesOrderLines.id));
  return lines;
}

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: salesOrders.id,
      orderNo: salesOrders.orderNo,
      buyerId: salesOrders.buyerId,
      buyerName: buyers.buyerName,
      orderDate: salesOrders.orderDate,
      deliveryDate: salesOrders.deliveryDate,
      currency: salesOrders.currency,
      orderStatus: salesOrders.orderStatus,
      priority: salesOrders.priority,
      createdAt: salesOrders.createdAt,
    })
    .from(salesOrders)
    .leftJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .orderBy(desc(salesOrders.createdAt));

  const ids = rows.map((r) => r.id);
  const lines = ids.length
    ? await db
        .select({ orderId: salesOrderLines.orderId, quantity: salesOrderLines.quantity })
        .from(salesOrderLines)
        .where(inArray(salesOrderLines.orderId, ids))
    : [];

  const countByOrder = new Map();
  const qtyByOrder = new Map();
  for (const l of lines) {
    countByOrder.set(l.orderId, (countByOrder.get(l.orderId) || 0) + 1);
    qtyByOrder.set(l.orderId, (qtyByOrder.get(l.orderId) || 0) + l.quantity);
  }

  const orders = rows.map((r) => ({
    ...r,
    lineCount: countByOrder.get(r.id) || 0,
    totalQty: qtyByOrder.get(r.id) || 0,
  }));
  return res.json({ orders, total: orders.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db
    .select({
      id: salesOrders.id,
      orderNo: salesOrders.orderNo,
      buyerId: salesOrders.buyerId,
      buyerName: buyers.buyerName,
      orderDate: salesOrders.orderDate,
      deliveryDate: salesOrders.deliveryDate,
      currency: salesOrders.currency,
      orderStatus: salesOrders.orderStatus,
      priority: salesOrders.priority,
      remarks: salesOrders.remarks,
      createdAt: salesOrders.createdAt,
    })
    .from(salesOrders)
    .leftJoin(buyers, eq(salesOrders.buyerId, buyers.id))
    .where(eq(salesOrders.id, id))
    .limit(1);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  const lines = await hydrateLines(id);
  return res.json({ order, lines });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const { buyerId, orderDate, deliveryDate, currency, priority, remarks, lines } = req.body || {};

  if (!buyerId || !orderDate || !deliveryDate) {
    return res.status(400).json({ message: 'buyerId, orderDate and deliveryDate are required.' });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ message: 'At least one order line is required.' });
  }
  for (const line of lines) {
    const err = validateLine(line);
    if (err) return res.status(400).json({ message: err });
  }

  const [buyer] = await db.select({ id: buyers.id, currency: buyers.currency }).from(buyers).where(eq(buyers.id, Number(buyerId))).limit(1);
  if (!buyer) return res.status(400).json({ message: 'Buyer not found.' });

  const orderNo = await nextDocNo(db, 'SO');
  const [inserted] = await db.insert(salesOrders).values({
    orderNo,
    buyerId: Number(buyerId),
    orderDate,
    deliveryDate,
    currency: currency || buyer.currency || 'USD',
    priority: priority || 'Normal',
    remarks: remarks || null,
    createdBy: req.user.id,
  });
  const orderId = inserted.insertId;

  await db.transaction(async (tx) => {
    for (const line of lines) {
      // Resolve BOM: prefer explicit, else active version of the style.
      let bomVersionId = line.bomVersionId ? Number(line.bomVersionId) : null;
      if (!bomVersionId) {
        // Default to the ACTIVE BOM version of the style (never the latest
        // draft - a newer draft must not silently change an order's BOM).
        const [v] = await tx
          .select({ id: bomVersions.id })
          .from(bomVersions)
          .where(
            and(
              eq(bomVersions.styleId, Number(line.styleId)),
              eq(bomVersions.status, 'Active')
            )
          )
          .orderBy(desc(bomVersions.versionNo))
          .limit(1);
        bomVersionId = v ? v.id : null;
      }
      await tx.insert(salesOrderLines).values({
        orderId,
        styleId: Number(line.styleId),
        color: String(line.color).trim(),
        quantity: Number(line.quantity),
        sizeBreakdown: line.sizeBreakdown || null,
        unitPrice: line.unitPrice !== undefined && line.unitPrice !== '' ? String(line.unitPrice) : null,
        bomVersionId,
      });
    }
  });

  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId)).limit(1);
  const orderLines = await hydrateLines(orderId);
  return res.status(201).json({ message: `Order ${orderNo} created.`, order, lines: orderLines });
});

/* --------------------------- Status transition ----------------------- */

router.post('/:id/status', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const id = Number(req.params.id);
  const { status, remarks } = req.body || {};
  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${ORDER_STATUSES.join(', ')}.` });
  }
  const [existing] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Order not found.' });

  const oldStatus = existing.orderStatus;
  await db.transaction(async (tx) => {
    await tx.update(salesOrders).set({ orderStatus: status }).where(eq(salesOrders.id, id));
    await tx.insert(orderAmendments).values({
      orderId: id,
      field: 'orderStatus',
      oldValue: oldStatus,
      newValue: status,
      amendedBy: req.user.id,
    });
    // Propagate to lines.
    if (status === 'Confirmed') {
      await tx.update(salesOrderLines).set({ lineStatus: 'Booked' }).where(eq(salesOrderLines.orderId, id));
    }
    if (status === 'In_Production') {
      await tx.update(salesOrderLines).set({ lineStatus: 'In_Production' }).where(eq(salesOrderLines.orderId, id));
    }
    if (status === 'Completed') {
      await tx.update(salesOrderLines).set({ lineStatus: 'Completed' }).where(eq(salesOrderLines.orderId, id));
    }
    if (status === 'Cancelled') {
      await tx.update(salesOrderLines).set({ lineStatus: 'Cancelled' }).where(eq(salesOrderLines.orderId, id));
    }
  });
  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  return res.json({ message: `Order status updated to ${status}.`, order });
});

/* ------------------------------ Update ------------------------------- */

router.put('/:id', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Order not found.' });

  const { deliveryDate, priority, remarks, currency } = req.body || {};
  const amendments = [];
  if (deliveryDate && String(deliveryDate) !== String(existing.deliveryDate)) {
    amendments.push({ field: 'deliveryDate', oldValue: existing.deliveryDate, newValue: deliveryDate });
  }
  if (priority && priority !== existing.priority) {
    amendments.push({ field: 'priority', oldValue: existing.priority, newValue: priority });
  }

  await db.transaction(async (tx) => {
    await tx.update(salesOrders).set({
      ...(deliveryDate ? { deliveryDate } : {}),
      ...(priority ? { priority } : {}),
      ...(currency ? { currency } : {}),
      ...(remarks !== undefined ? { remarks } : {}),
    }).where(eq(salesOrders.id, id));
    for (const a of amendments) {
      await tx.insert(orderAmendments).values({ orderId: id, ...a, amendedBy: req.user.id });
    }
  });

  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  return res.json({ message: 'Order updated.', order });
});

/* --------------------------- Line operations ------------------------- */

router.put('/:id/lines/:lineId', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const id = Number(req.params.id);
  const lineId = Number(req.params.lineId);
  const [line] = await db
    .select()
    .from(salesOrderLines)
    .where(eq(salesOrderLines.id, lineId))
    .limit(1);
  if (!line || line.orderId !== id) return res.status(404).json({ message: 'Order line not found.' });

  const { quantity, sizeBreakdown, unitPrice, bomVersionId } = req.body || {};
  if (quantity !== undefined && (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0)) {
    return res.status(400).json({ message: 'quantity must be a positive integer.' });
  }
  await db.transaction(async (tx) => {
    await tx.update(salesOrderLines).set({
      ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
      ...(sizeBreakdown !== undefined ? { sizeBreakdown } : {}),
      ...(unitPrice !== undefined ? { unitPrice: unitPrice !== '' ? String(unitPrice) : null } : {}),
      ...(bomVersionId !== undefined ? { bomVersionId: bomVersionId ? Number(bomVersionId) : null } : {}),
    }).where(eq(salesOrderLines.id, lineId));
    if (quantity !== undefined && Number(quantity) !== line.quantity) {
      await tx.insert(orderAmendments).values({
        orderId: id,
        field: `line ${lineId} quantity`,
        oldValue: String(line.quantity),
        newValue: String(quantity),
        amendedBy: req.user.id,
      });
    }
  });
  const lines = await hydrateLines(id);
  return res.json({ message: 'Line updated.', lines });
});

/* ----------------------------- Amendments ---------------------------- */

router.get('/:id/amendments', authenticate, async (req, res) => {
  const rows = await db
    .select()
    .from(orderAmendments)
    .where(eq(orderAmendments.orderId, Number(req.params.id)))
    .orderBy(desc(orderAmendments.amendedAt));
  return res.json({ amendments: rows });
});

router.post('/:id/amendments', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const { field, oldValue, newValue } = req.body || {};
  if (!field) return res.status(400).json({ message: 'field is required.' });
  const [inserted] = await db.insert(orderAmendments).values({
    orderId: Number(req.params.id),
    field,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    amendedBy: req.user.id,
  });
  const [row] = await db.select().from(orderAmendments).where(eq(orderAmendments.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Amendment recorded.', amendment: row });
});

module.exports = router;
