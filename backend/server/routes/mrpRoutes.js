/**
 * MRP routes - requirement calculation + material reservation.
 *
 *   GET  /api/mrp/orders/:id              compute MRP for an order (no persist)
 *   POST /api/mrp/orders/:id/generate     compute + persist material_requirements
 *   POST /api/mrp/orders/:id/reserve      reserve available stock up to shortage
 *   GET  /api/mrp/materials/:materialId   stock snapshot for a material
 */
const { Router } = require('express');
const { eq, and, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  salesOrders,
  testMaterials,
  materialReservations,
  materialRequirements,
} = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const { computeOrderMrp, computeOrderMrpWithExclusions, round } = require('../services/mrp');

const router = Router();

/* ------------------------- Compute MRP (dry) ------------------------ */

router.get('/orders/:id', authenticate, async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await computeOrderMrp(orderId, { persist: false });
  return res.json({
    order: result.order,
    requirements: result.requirements,
    totalShortage: round(result.requirements.reduce((s, r) => s + r.shortage, 0)),
    generatedAt: new Date().toISOString(),
  });
});

/* ---------------------- Compute + persist requirements -------------- */

router.post('/orders/:id/generate', authenticate, async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await computeOrderMrp(orderId, { persist: true });
  return res.json({
    message: 'Material requirements generated.',
    order: result.order,
    requirements: result.requirements,
    totalShortage: round(result.requirements.reduce((s, r) => s + r.shortage, 0)),
  });
});

/* --------------------------- Reserve stock -------------------------- */

router.post('/orders/:id/reserve', authenticate, authorizeForReserve, async (req, res) => {
  const orderId = Number(req.params.id);
  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId)).limit(1);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  // Exclude this order's own reservations so availability is not understated
  // and repeat reservations do not double-subtract.
  const { requirements } = await computeOrderMrpWithExclusions(orderId, { persist: false, excludeOrderId: orderId });

  const reserved = [];
  await db.transaction(async (tx) => {
    for (const r of requirements) {
      if (r.shortage >= r.netQty) continue; // nothing available to reserve

      // Already reserved for this order?
      const existingRows = await tx
        .select({ id: materialReservations.id, qty: materialReservations.qty })
        .from(materialReservations)
        .where(
          and(
            eq(materialReservations.orderId, orderId),
            eq(materialReservations.materialId, r.materialId),
            eq(materialReservations.status, 'Active')
          )
        )
        .limit(1);
      let existingRes = existingRows[0] || null;

      const already = existingRes ? Number(existingRes.qty) : 0;
      // r.available already excludes this order's own reservation (the MRP
      // engine was called with excludeOrderId), so no double subtraction.
      const canReserve = Math.max(0, r.available);
      const toReserve = Math.min(canReserve, Math.max(0, r.netQty - already));

      if (toReserve > 0) {
        if (existingRes) {
          await tx
            .update(materialReservations)
            .set({ qty: String(already + toReserve) })
            .where(eq(materialReservations.id, existingRes.id));
        } else {
          const [ins] = await tx.insert(materialReservations).values({
            orderId,
            materialId: r.materialId,
            qty: String(toReserve),
            status: 'Active',
            createdBy: req.user.id,
          });
          existingRes = { id: ins.insertId, qty: '0' };
        }
        reserved.push({
          materialId: r.materialId,
          materialCode: r.materialCode,
          materialName: r.materialName,
          reserved: round(already + toReserve),
          requested: round(r.netQty),
        });
      }
    }
  });

  return res.json({
    message: reserved.length > 0 ? 'Stock reserved for order.' : 'No additional stock available to reserve.',
    reserved,
  });
});

function authorizeForReserve(req, res, next) {
  const allowed = ['Admin', 'Merchandiser', 'Store_Manager'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: `Access denied. Allowed roles: ${allowed.join(', ')}.` });
  }
  return next();
}

/* ---------------------- Material stock snapshot --------------------- */

router.get('/materials/:materialId', authenticate, async (req, res) => {
  const materialId = Number(req.params.materialId);
  const [material] = await db
    .select({
      id: testMaterials.id,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      stockQuantity: testMaterials.stockQuantity,
      unit: testMaterials.unit,
    })
    .from(testMaterials)
    .where(eq(testMaterials.id, materialId))
    .limit(1);
  if (!material) return res.status(404).json({ message: 'Material not found.' });

  const [reservedRow] = await db
    .select({ total: sql`COALESCE(SUM(${materialReservations.qty}), 0)` })
    .from(materialReservations)
    .where(
      and(
        eq(materialReservations.materialId, materialId),
        eq(materialReservations.status, 'Active')
      )
    );
  const reserved = Number(reservedRow?.total || 0);

  const [requirementsRow] = await db
    .select({ total: sql`COALESCE(SUM(${materialRequirements.netQty}), 0)` })
    .from(materialRequirements)
    .where(eq(materialRequirements.materialId, materialId));
  const required = Number(requirementsRow?.total || 0);

  const physical = Number(material.stockQuantity);
  return res.json({
    material,
    physical,
    reserved,
    available: round(physical - reserved),
    committedToOrders: round(required),
  });
});

module.exports = router;
