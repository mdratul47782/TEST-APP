/**
 * MRP Engine - Material Requirement Planning calculation service.
 *
 * Pure calculation (read + compute); the only write is persisting the
 * resulting `material_requirements` rows for an order.
 *
 * Formula per material:
 *   gross      = orderQty × bom.consumption
 *   net        = gross × (1 + wastage%)
 *   physical   = test_materials.stock_quantity     (ledger-maintained cache)
 *   reserved   = SUM(Active reservations for the material, OTHER orders)
 *   available  = physical − reserved               (never includes reserved stock)
 *   incoming   = SUM(open PO items qty − received − cancelled for the material)
 *   projected  = available + incoming
 *   shortage   = MAX(0, net − projected)
 *   suggested  = CEILING(shortage / MOQ) × MOQ      (rounded up to preferred-supplier MOQ)
 */
const { eq, and, asc, desc, ne, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  salesOrders,
  salesOrderLines,
  bomVersions,
  bomItems,
  testMaterials,
  suppliers,
  materialReservations,
  materialRequirements,
  purchaseOrderItems,
  purchaseOrders,
  supplierMaterials,
} = require('../db/schema');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Compute MRP for a single order.
 * @param {number} orderId
 * @param {object} [opts] { persist: boolean }
 * @returns {Promise<{order: object, requirements: Array<object>}>}
 */
async function computeOrderMrp(orderId, { persist = false } = {}) {
  return computeOrderMrpWithExclusions(orderId, { persist });
}

/**
 * Core MRP computation. `excludeOrderId` is used when calculating the
 * availability for a single order so its own reservations are not counted
 * as "reserved by others" (Q9 in the design: reserved = other orders).
 */
async function computeOrderMrpWithExclusions(orderId, { persist = false, excludeOrderId = null } = {}) {
  const [order] = await db
    .select({
      id: salesOrders.id,
      orderNo: salesOrders.orderNo,
      buyerId: salesOrders.buyerId,
      deliveryDate: salesOrders.deliveryDate,
      currency: salesOrders.currency,
      orderStatus: salesOrders.orderStatus,
    })
    .from(salesOrders)
    .where(eq(salesOrders.id, orderId))
    .limit(1);

  if (!order) {
    const err = new Error('Order not found.');
    err.status = 404;
    throw err;
  }

  // All order lines + their BOM versions (per style).
  const lines = await db
    .select({
      id: salesOrderLines.id,
      styleId: salesOrderLines.styleId,
      color: salesOrderLines.color,
      quantity: salesOrderLines.quantity,
      bomVersionId: salesOrderLines.bomVersionId,
    })
    .from(salesOrderLines)
    .where(eq(salesOrderLines.orderId, orderId));

  // Group lines by BOM version (fall back to active version of the style).
  const activeBomVersion = new Map();
  for (const line of lines) {
    let versionId = line.bomVersionId;
    if (!versionId) {
      if (!activeBomVersion.has(line.styleId)) {
        const [v] = await db
          .select({ id: bomVersions.id })
          .from(bomVersions)
          .where(
            and(
              eq(bomVersions.styleId, line.styleId),
              eq(bomVersions.status, 'Active')
            )
          )
          .orderBy(desc(bomVersions.versionNo))
          .limit(1);
        activeBomVersion.set(line.styleId, v ? v.id : null);
      }
      versionId = activeBomVersion.get(line.styleId);
    }
    line.bomVersionId = versionId;
  }

  // Aggregate order quantity per (material, bomVersionId).
  const qtyByMaterial = new Map(); // key: `${bomVersionId}:${materialId}`
  const versionByKey = new Map();

  for (const line of lines) {
    if (!line.bomVersionId) continue;
    const items = await db
      .select({
        materialId: bomItems.materialId,
        materialName: bomItems.materialName,
        category: bomItems.category,
        unit: bomItems.unit,
        consumption: bomItems.consumption,
        wastagePct: bomItems.wastagePct,
        preferredSupplierId: bomItems.preferredSupplierId,
      })
      .from(bomItems)
      .where(eq(bomItems.bomVersionId, line.bomVersionId));

    for (const item of items) {
      if (!item.materialId) continue;
      const key = `${line.bomVersionId}:${item.materialId}`;
      const entry = qtyByMaterial.get(key) || { ...item, orderQty: 0 };
      entry.orderQty += line.quantity;
      qtyByMaterial.set(key, entry);
      versionByKey.set(key, line.bomVersionId);
    }
  }

  // Pull current stock + reservations + incoming for the involved materials.
  const materialIds = [...new Set([...qtyByMaterial.values()].map((e) => e.materialId))];
  const materialById = new Map();
  if (materialIds.length > 0) {
    const mats = await db
      .select({
        id: testMaterials.id,
        materialCode: testMaterials.materialCode,
        materialName: testMaterials.materialName,
        category: testMaterials.category,
        stockQuantity: testMaterials.stockQuantity,
        unit: testMaterials.unit,
        testStatus: testMaterials.testStatus,
      })
      .from(testMaterials)
      .where(inArray(testMaterials.id, materialIds));
    for (const m of mats) materialById.set(m.id, m);
  }

  const reservations = await db
    .select({
      materialId: materialReservations.materialId,
      orderId: materialReservations.orderId,
      qty: materialReservations.qty,
    })
    .from(materialReservations)
    .where(
      and(
        eq(materialReservations.status, 'Active'),
        materialIds.length > 0 ? inArray(materialReservations.materialId, materialIds) : undefined
      )
    );

  // Sum reservations from OTHER orders only (the planning view of
  // "reserved" for a given order must not include its own reservations).
  const reservedByMaterial = new Map();
  for (const r of reservations) {
    if (excludeOrderId && Number(r.orderId) === Number(excludeOrderId)) continue;
    reservedByMaterial.set(
      r.materialId,
      (reservedByMaterial.get(r.materialId) || 0) + toNum(r.qty)
    );
  }

  // Incoming = open PO quantities not yet received/cancelled.
  const poItems = await db
    .select({
      materialId: purchaseOrderItems.materialId,
      qty: purchaseOrderItems.qty,
      receivedQty: purchaseOrderItems.receivedQty,
      cancelledQty: purchaseOrderItems.cancelledQty,
      poStatus: purchaseOrders.status,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.poId, purchaseOrders.id))
    .where(
      and(
        ne(purchaseOrders.status, 'Cancelled'),
        materialIds.length > 0 ? inArray(purchaseOrderItems.materialId, materialIds) : undefined
      )
    );

  const incomingByMaterial = new Map();
  for (const i of poItems) {
    const remaining = toNum(i.qty) - toNum(i.receivedQty) - toNum(i.cancelledQty);
    if (remaining > 0) {
      incomingByMaterial.set(
        i.materialId,
        (incomingByMaterial.get(i.materialId) || 0) + remaining
      );
    }
  }

  // Preferred supplier MOQ + lead time.
  const preferredById = new Map();
  const smRows = await db
    .select({
      id: supplierMaterials.id,
      supplierId: supplierMaterials.supplierId,
      materialId: supplierMaterials.materialId,
      moq: supplierMaterials.moq,
      leadTimeDays: supplierMaterials.leadTimeDays,
      isPreferred: supplierMaterials.isPreferred,
      supplierName: suppliers.supplierName,
      rating: suppliers.rating,
    })
    .from(supplierMaterials)
    .innerJoin(suppliers, eq(supplierMaterials.supplierId, suppliers.id))
    .where(
      materialIds.length > 0 ? inArray(supplierMaterials.materialId, materialIds) : undefined
    )
    .orderBy(desc(supplierMaterials.isPreferred), asc(supplierMaterials.leadTimeDays));

  for (const s of smRows) {
    if (!preferredById.has(s.materialId)) preferredById.set(s.materialId, s);
  }

  // Build requirement rows.
  const requirements = [];
  for (const [key, entry] of qtyByMaterial) {
    const material = materialById.get(entry.materialId);
    if (!material) continue;

    const gross = toNum(entry.orderQty) * toNum(entry.consumption);
    const wastageQty = gross * (toNum(entry.wastagePct) / 100);
    const net = gross + wastageQty;

    const physical = toNum(material.stockQuantity);
    const reserved = reservedByMaterial.get(entry.materialId) || 0;
    const available = physical - reserved;
    const incoming = incomingByMaterial.get(entry.materialId) || 0;
    const projected = available + incoming;
    const shortage = Math.max(0, net - projected);

    const pref = preferredById.get(entry.materialId) || null;
    const moq = toNum(pref?.moq) > 0 ? toNum(pref.moq) : 1;
    const suggestedQty = shortage > 0 ? Math.ceil(shortage / moq) * moq : 0;

    requirements.push({
      materialId: material.id,
      materialCode: material.materialCode,
      materialName: material.materialName,
      category: material.category,
      unit: material.unit,
      bomVersionId: versionByKey.get(key),
      orderQty: entry.orderQty,
      consumption: toNum(entry.consumption),
      wastagePct: toNum(entry.wastagePct),
      grossQty: round(gross),
      wastageQty: round(wastageQty),
      netQty: round(net),
      physical: round(physical),
      reserved: round(reserved),
      available: round(available),
      incoming: round(incoming),
      projected: round(projected),
      shortage: round(shortage),
      suggestedQty: round(suggestedQty),
      action: shortage > 0 ? 'Purchase' : 'OK',
      preferredSupplier: pref
        ? { id: pref.supplierId, name: pref.supplierName, moq, leadTimeDays: pref.leadTimeDays, rating: pref.rating }
        : null,
    });
  }

  if (persist && requirements.length > 0) {
    await db.transaction(async (tx) => {
      await tx.delete(materialRequirements).where(eq(materialRequirements.orderId, orderId));
      for (const r of requirements) {
        await tx.insert(materialRequirements).values({
          orderId,
          materialId: r.materialId,
          bomVersionId: r.bomVersionId,
          grossQty: r.grossQty,
          wastageQty: r.wastageQty,
          netQty: r.netQty,
        });
      }
    });
  }

  return { order, requirements };
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

module.exports = { computeOrderMrp, computeOrderMrpWithExclusions, round };
