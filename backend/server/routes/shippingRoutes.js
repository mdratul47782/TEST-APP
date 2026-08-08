/**
 * Shipping routes - finished goods + shipment planning.
 *
 *   GET  /api/finished-goods              list FG stock
 *   POST /api/finished-goods              add FG (from production output)
 *   POST /api/finished-goods/:id/status   mark packed
 *   GET  /api/shipments                   list shipments
 *   GET  /api/shipments/:id               detail
 *   POST /api/shipments                   create shipment
 *   POST /api/shipments/:id/status        transition
 */
const { Router } = require('express');
const { eq, asc, desc, and, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  finishedGoods,
  shipments,
  shipmentItems,
  productionOrders,
  salesOrderLines,
  salesOrders,
  styles,
  buyers,
  warehouses,
  FG_STATUSES,
  SHIPMENT_STATUSES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');

const router = Router();

/* --------------------------- Finished goods -------------------------- */

router.get('/finished-goods', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: finishedGoods.id,
      fgNo: finishedGoods.fgNo,
      productionOrderId: finishedGoods.productionOrderId,
      productionOrderNo: productionOrders.productionOrderNo,
      salesOrderLineId: finishedGoods.salesOrderLineId,
      orderNo: salesOrders.orderNo,
      styleNumber: styles.styleNumber,
      color: finishedGoods.color,
      size: finishedGoods.size,
      qty: finishedGoods.qty,
      cartonNo: finishedGoods.cartonNo,
      status: finishedGoods.status,
      createdAt: finishedGoods.createdAt,
    })
    .from(finishedGoods)
    .leftJoin(productionOrders, eq(finishedGoods.productionOrderId, productionOrders.id))
    .leftJoin(salesOrderLines, eq(finishedGoods.salesOrderLineId, salesOrderLines.id))
    .leftJoin(salesOrders, eq(salesOrderLines.orderId, salesOrders.id))
    .leftJoin(styles, eq(finishedGoods.styleId, styles.id))
    .orderBy(desc(finishedGoods.createdAt));
  return res.json({ finishedGoods: rows, total: rows.length });
});

router.post('/finished-goods', authenticate, authorize('Admin', 'Store_Manager', 'Production_Manager'), async (req, res) => {
  const { productionOrderId, salesOrderLineId, color, size, qty, cartonNo, warehouseId } = req.body || {};
  if (!productionOrderId || !qty || Number(qty) <= 0) {
    return res.status(400).json({ message: 'productionOrderId and qty > 0 are required.' });
  }
  const [po] = await db.select().from(productionOrders).where(eq(productionOrders.id, Number(productionOrderId))).limit(1);
  if (!po) return res.status(404).json({ message: 'Production order not found.' });

  const fgNo = await nextDocNo(db, 'FG');
  const [inserted] = await db.insert(finishedGoods).values({
    fgNo,
    productionOrderId: po.id,
    salesOrderLineId: salesOrderLineId || po.salesOrderLineId,
    styleId: po.styleId,
    color: color || null,
    size: size || null,
    qty: Number(qty),
    cartonNo: cartonNo || null,
    status: 'In_Stock',
    warehouseId: warehouseId ? Number(warehouseId) : null,
  });
  const [row] = await db.select().from(finishedGoods).where(eq(finishedGoods.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: `${fgNo} added to FG warehouse.`, finishedGood: row });
});

router.post('/finished-goods/:id/status', authenticate, authorize('Admin', 'Store_Manager'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !FG_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${FG_STATUSES.join(', ')}.` });
  }
  await db.update(finishedGoods).set({ status }).where(eq(finishedGoods.id, id));
  const [row] = await db.select().from(finishedGoods).where(eq(finishedGoods.id, id)).limit(1);
  return res.json({ message: `FG ${row.fgNo} marked ${status}.`, finishedGood: row });
});

/* ------------------------------ Shipments ---------------------------- */

router.get('/shipments', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: shipments.id,
      shipmentNo: shipments.shipmentNo,
      salesOrderId: shipments.salesOrderId,
      orderNo: salesOrders.orderNo,
      buyerId: shipments.buyerId,
      buyerName: buyers.buyerName,
      destination: shipments.destination,
      shipmentDate: shipments.shipmentDate,
      status: shipments.status,
      createdAt: shipments.createdAt,
    })
    .from(shipments)
    .leftJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
    .leftJoin(buyers, eq(shipments.buyerId, buyers.id))
    .orderBy(desc(shipments.createdAt));
  return res.json({ shipments: rows, total: rows.length });
});

router.get('/shipments/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [shipment] = await db
    .select({
      id: shipments.id,
      shipmentNo: shipments.shipmentNo,
      salesOrderId: shipments.salesOrderId,
      orderNo: salesOrders.orderNo,
      buyerId: shipments.buyerId,
      buyerName: buyers.buyerName,
      destination: shipments.destination,
      shipmentDate: shipments.shipmentDate,
      status: shipments.status,
      remarks: shipments.remarks,
      createdAt: shipments.createdAt,
    })
    .from(shipments)
    .leftJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
    .leftJoin(buyers, eq(shipments.buyerId, buyers.id))
    .where(eq(shipments.id, id))
    .limit(1);
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });

  const items = await db
    .select({
      id: shipmentItems.id,
      salesOrderLineId: shipmentItems.salesOrderLineId,
      styleNumber: styles.styleNumber,
      color: salesOrderLines.color,
      qty: shipmentItems.qty,
      cartons: shipmentItems.cartons,
      sizeBreakdown: shipmentItems.sizeBreakdown,
    })
    .from(shipmentItems)
    .leftJoin(salesOrderLines, eq(shipmentItems.salesOrderLineId, salesOrderLines.id))
    .leftJoin(styles, eq(salesOrderLines.styleId, styles.id))
    .where(eq(shipmentItems.shipmentId, id));
  return res.json({ shipment, items });
});

router.post('/shipments', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const { salesOrderId, destination, shipmentDate, remarks, items } = req.body || {};
  if (!salesOrderId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'salesOrderId and at least one item are required.' });
  }
  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, Number(salesOrderId))).limit(1);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  const shipmentNo = await nextDocNo(db, 'SH');
  const [inserted] = await db.insert(shipments).values({
    shipmentNo,
    salesOrderId: order.id,
    buyerId: order.buyerId,
    destination: destination || null,
    shipmentDate: shipmentDate || null,
    status: 'Planned',
    remarks: remarks || null,
  });
  const shipmentId = inserted.insertId;

  for (const it of items) {
    if (!it.salesOrderLineId || !it.qty || Number(it.qty) <= 0) continue;
    await db.insert(shipmentItems).values({
      shipmentId,
      salesOrderLineId: Number(it.salesOrderLineId),
      qty: Number(it.qty),
      cartons: Number(it.cartons) || 0,
      sizeBreakdown: it.sizeBreakdown || null,
    });
  }

  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  return res.status(201).json({ message: `${shipmentNo} planned.`, shipment });
});

router.post('/shipments/:id/status', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !SHIPMENT_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${SHIPMENT_STATUSES.join(', ')}.` });
  }
  await db.transaction(async (tx) => {
    await tx.update(shipments).set({ status }).where(eq(shipments.id, id));
    if (status === 'Shipped' || status === 'Completed') {
      const items = await tx.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, id));
      for (const it of items) {
        if (it.salesOrderLineId) {
          await tx
            .update(finishedGoods)
            .set({ status: 'Shipped' })
            .where(eq(finishedGoods.salesOrderLineId, it.salesOrderLineId));
        }
      }
    }
  });
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  return res.json({ message: `Shipment ${shipment.shipmentNo} is now ${status}.`, shipment });
});

module.exports = router;
