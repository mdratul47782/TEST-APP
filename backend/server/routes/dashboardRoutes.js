/**
 * Dashboard routes - management KPIs aggregated across modules.
 *
 *   GET /api/dashboard/summary   sales, material, purchase, production, shipment KPIs
 */
const { Router } = require('express');
const { eq, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  salesOrders,
  salesOrderLines,
  testMaterials,
  materialReservations,
  purchaseRequisitions,
  purchaseOrders,
  purchaseOrderItems,
  productionOrders,
  finishedGoods,
  shipments,
  shipmentItems,
} = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/summary', authenticate, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  /* ------------------------------- Sales ------------------------------ */
  const openOrders = await db
    .select({ id: salesOrders.id })
    .from(salesOrders)
    .where(sql`${salesOrders.orderStatus} NOT IN ('Completed', 'Cancelled')`);
  const allLines = await db
    .select({ orderId: salesOrderLines.orderId, quantity: salesOrderLines.quantity, orderStatus: salesOrders.orderStatus })
    .from(salesOrderLines)
    .innerJoin(salesOrders, eq(salesOrderLines.orderId, salesOrders.id));

  const activeLineIds = await db
    .select({ id: salesOrders.id, deliveryDate: salesOrders.deliveryDate })
    .from(salesOrders)
    .where(sql`${salesOrders.orderStatus} NOT IN ('Completed', 'Cancelled')`);

  const upcomingDeliveries = activeLineIds.filter((o) => String(o.deliveryDate) >= today).length;
  const delayedOrders = activeLineIds.filter((o) => String(o.deliveryDate) < today).length;

  const totalOrderQty = allLines.reduce((s, l) => s + l.quantity, 0);

  /* ----------------------------- Materials ---------------------------- */
  const materials = await db.select().from(testMaterials);
  const reservations = await db
    .select({ materialId: materialReservations.materialId, qty: materialReservations.qty })
    .from(materialReservations)
    .where(eq(materialReservations.status, 'Active'));
  const reservedQty = reservations.reduce((s, r) => s + Number(r.qty), 0);
  const physicalQty = materials.reduce((s, m) => s + Number(m.stockQuantity), 0);
  const lowStockCount = materials.filter((m) => Number(m.stockQuantity) <= Number(m.safetyStock || 0)).length;

  /* ----------------------------- Purchasing --------------------------- */
  const [prPending] = await db
    .select({ count: sql`COUNT(*) AS count` })
    .from(purchaseRequisitions)
    .where(sql`${purchaseRequisitions.status} IN ('Draft', 'Pending_Approval', 'Approved')`);
  const [poOpen] = await db
    .select({ count: sql`COUNT(*) AS count` })
    .from(purchaseOrders)
    .where(sql`${purchaseOrders.status} NOT IN ('Received', 'Cancelled')`);

  const openPos = await db
    .select({ id: purchaseOrders.id, deliveryDate: purchaseOrders.deliveryDate })
    .from(purchaseOrders)
    .where(sql`${purchaseOrders.status} NOT IN ('Received', 'Cancelled')`);
  const overduePos = openPos.filter((o) => o.deliveryDate && String(o.deliveryDate) < today).length;

  const incomingQty = await db
    .select({
      total: sql`SUM(${purchaseOrderItems.qty} - ${purchaseOrderItems.receivedQty} - ${purchaseOrderItems.cancelledQty}) AS total`,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.poId, purchaseOrders.id))
    .where(sql`${purchaseOrders.status} NOT IN ('Received', 'Cancelled')`);

  /* ----------------------------- Production --------------------------- */
  const prodRows = await db.select().from(productionOrders);
  const countBy = (status) => prodRows.filter((p) => p.status === status).length;
  const wip = prodRows
    .filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled')
    .reduce((s, p) => s + p.qty, 0);

  /* ------------------------------ Shipping ---------------------------- */
  const fgRows = await db.select().from(finishedGoods);
  const readyToShip = fgRows.filter((f) => f.status === 'In_Stock').reduce((s, f) => s + f.qty, 0);
  const packed = fgRows.filter((f) => f.status === 'Packed').reduce((s, f) => s + f.qty, 0);
  const shipped = fgRows.filter((f) => f.status === 'Shipped').reduce((s, f) => s + f.qty, 0);

  const shipRows = await db.select().from(shipments);
  const shipmentsByStatus = {
    Planned: shipRows.filter((s) => s.status === 'Planned').length,
    Partially_Shipped: shipRows.filter((s) => s.status === 'Partially_Shipped').length,
    Shipped: shipRows.filter((s) => s.status === 'Shipped').length,
    Completed: shipRows.filter((s) => s.status === 'Completed').length,
  };

  return res.json({
    generatedAt: new Date().toISOString(),
    sales: {
      openOrders: openOrders.length,
      totalOrderQty,
      upcomingDeliveries,
      delayedOrders,
    },
    material: {
      totalMaterials: materials.length,
      physicalQty,
      reservedQty: Math.round(reservedQty * 1000) / 1000,
      availableQty: Math.round((physicalQty - reservedQty) * 1000) / 1000,
      lowStockCount,
      incomingQty: Math.round(Number(incomingQty[0]?.total || 0) * 1000) / 1000,
    },
    purchase: {
      pendingPR: Number(prPending[0]?.count || 0),
      openPO: Number(poOpen[0]?.count || 0),
      overduePO: overduePos,
    },
    production: {
      cutting: countBy('In_Cutting'),
      sewing: countBy('In_Sewing'),
      finishing: countBy('In_Finishing'),
      readyForCutting: countBy('Ready_For_Cutting'),
      wip,
      totalOrders: prodRows.length,
    },
    shipping: {
      readyToShip,
      packed,
      shipped,
      ...shipmentsByStatus,
    },
  });
});

module.exports = router;
