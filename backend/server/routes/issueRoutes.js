/**
 * Material issue routes - production requests material from warehouse.
 * Workflow: Requested -> Approved -> Issued (stock decremented, reservations
 * released atomically).
 *
 *   GET  /api/issues                list issues
 *   GET  /api/issues/:id            detail with items
 *   POST /api/issues                create issue request
 *   POST /api/issues/:id/status     approve / issue / reject / partial
 */
const { Router } = require('express');
const { eq, asc, desc, and } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  materialIssues,
  materialIssueItems,
  materialReservations,
  productionOrders,
  salesOrderLines,
  testMaterials,
  warehouses,
  ISSUE_STATUSES,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');
const { moveStock } = require('../services/inventory');

const router = Router();

async function hydrateItems(issueId) {
  return db
    .select({
      id: materialIssueItems.id,
      materialId: materialIssueItems.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      unit: materialIssueItems.unit,
      requestedQty: materialIssueItems.requestedQty,
      issuedQty: materialIssueItems.issuedQty,
    })
    .from(materialIssueItems)
    .leftJoin(testMaterials, eq(materialIssueItems.materialId, testMaterials.id))
    .where(eq(materialIssueItems.issueId, issueId))
    .orderBy(asc(materialIssueItems.id));
}

/* ------------------------------- List -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: materialIssues.id,
      issueNo: materialIssues.issueNo,
      productionOrderId: materialIssues.productionOrderId,
      productionOrderNo: productionOrders.productionOrderNo,
      warehouseId: materialIssues.warehouseId,
      warehouseName: warehouses.warehouseName,
      issuedTo: materialIssues.issuedTo,
      status: materialIssues.status,
      issueDate: materialIssues.issueDate,
      createdAt: materialIssues.createdAt,
    })
    .from(materialIssues)
    .leftJoin(productionOrders, eq(materialIssues.productionOrderId, productionOrders.id))
    .leftJoin(warehouses, eq(materialIssues.warehouseId, warehouses.id))
    .orderBy(desc(materialIssues.createdAt));

  const issues = [];
  for (const r of rows) {
    const items = await hydrateItems(r.id);
    issues.push({ ...r, items });
  }
  return res.json({ issues, total: issues.length });
});

/* ------------------------------- Detail ------------------------------ */

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const [issue] = await db.select().from(materialIssues).where(eq(materialIssues.id, id)).limit(1);
  if (!issue) return res.status(404).json({ message: 'Issue not found.' });
  const items = await hydrateItems(id);
  return res.json({ issue, items });
});

/* ------------------------------- Create ------------------------------ */

router.post('/', authenticate, authorize('Admin', 'Production_Manager', 'Store_Manager'), async (req, res) => {
  const { productionOrderId, warehouseId, issuedTo, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one issue item is required.' });
  }
  for (const it of items) {
    if (!it.materialId || it.requestedQty === undefined || Number(it.requestedQty) <= 0) {
      return res.status(400).json({ message: 'Each item needs materialId and requestedQty > 0.' });
    }
  }

  const issueNo = await nextDocNo(db, 'MI');
  const [inserted] = await db.insert(materialIssues).values({
    issueNo,
    productionOrderId: productionOrderId ? Number(productionOrderId) : null,
    warehouseId: warehouseId ? Number(warehouseId) : null,
    issuedTo: issuedTo || null,
    status: 'Requested',
    createdBy: req.user.id,
  });
  const issueId = inserted.insertId;

  for (const it of items) {
    await db.insert(materialIssueItems).values({
      issueId,
      materialId: Number(it.materialId),
      requestedQty: String(it.requestedQty),
      issuedQty: '0',
      unit: it.unit || null,
    });
  }

  const [issue] = await db.select().from(materialIssues).where(eq(materialIssues.id, issueId)).limit(1);
  const hydrated = await hydrateItems(issueId);
  return res.status(201).json({ message: `${issueNo} requested.`, issue, items: hydrated });
});

/* --------------------------- Status transition ----------------------- */

router.post('/:id/status', authenticate, authorize('Admin', 'Store_Manager', 'Production_Manager'), async (req, res) => {
  const id = Number(req.params.id);
  const { status, issuedItems } = req.body || {};
  if (!status || !ISSUE_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${ISSUE_STATUSES.join(', ')}.` });
  }
  const [issue] = await db.select().from(materialIssues).where(eq(materialIssues.id, id)).limit(1);
  if (!issue) return res.status(404).json({ message: 'Issue not found.' });

  // Stock-out only happens at the "Issued" transition, performed by warehouse.
  if (status === 'Issued' && !['Admin', 'Store_Manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only Admin or Store Manager can issue stock.' });
  }

  await db.transaction(async (tx) => {
    if (status === 'Issued') {
      const items = await tx.select().from(materialIssueItems).where(eq(materialIssueItems.issueId, id));

      for (const it of items) {
        const issueQty = issuedItems?.[it.id] !== undefined ? Number(issuedItems[it.id]) : Number(it.requestedQty);
        if (issueQty <= 0) continue;

        // Decrement physical stock through the ledger.
        await moveStock(tx, {
          materialId: it.materialId,
          transactionType: 'Issue',
          qty: -issueQty,
          warehouseId: issue.warehouseId,
          referenceType: 'ISSUE',
          referenceId: it.id,
          remarks: `${issue.issueNo}`,
          userId: req.user.id,
        });

        // Release the matching reservation for the production order's order.
        if (issue.productionOrderId) {
          const [po] = await tx
            .select()
            .from(productionOrders)
            .where(eq(productionOrders.id, issue.productionOrderId))
            .limit(1);
          if (po) {
            const [orderLine] = await tx
              .select()
              .from(salesOrderLines)
              .where(eq(salesOrderLines.id, po.salesOrderLineId))
              .limit(1);
            if (orderLine) {
              const [reservation] = await tx
                .select()
                .from(materialReservations)
                .where(
                  and(
                    eq(materialReservations.orderId, orderLine.orderId),
                    eq(materialReservations.materialId, it.materialId),
                    eq(materialReservations.status, 'Active')
                  )
                )
                .limit(1);
              if (reservation) {
                const remaining = Number(reservation.qty) - issueQty;
                if (remaining <= 0) {
                  await tx
                    .update(materialReservations)
                    .set({ status: 'Released' })
                    .where(eq(materialReservations.id, reservation.id));
                } else {
                  await tx
                    .update(materialReservations)
                    .set({ qty: String(remaining) })
                    .where(eq(materialReservations.id, reservation.id));
                }
              }
            }
          }
        }

        await tx
          .update(materialIssueItems)
          .set({ issuedQty: String(issueQty) })
          .where(eq(materialIssueItems.id, it.id));
      }

      const allIssued = items.length > 0 && items.every((i) => {
        const q = issuedItems?.[i.id] !== undefined ? Number(issuedItems[i.id]) : Number(i.requestedQty);
        return q >= Number(i.requestedQty);
      });
      await tx
        .update(materialIssues)
        .set({ status: allIssued ? 'Issued' : 'Partial', issueDate: new Date().toISOString().slice(0, 10) })
        .where(eq(materialIssues.id, id));
    } else {
      await tx.update(materialIssues).set({ status }).where(eq(materialIssues.id, id));
    }
  });

  const [updated] = await db.select().from(materialIssues).where(eq(materialIssues.id, id)).limit(1);
  const hydrated = await hydrateItems(id);
  return res.json({ message: `Issue ${updated.issueNo} is now ${updated.status}.`, issue: updated, items: hydrated });
});

module.exports = router;
