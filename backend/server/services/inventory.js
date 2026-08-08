/**
 * Inventory ledger service - every stock change MUST go through these
 * helpers so the audit ledger (`stock_transactions`) stays in sync with the
 * `test_materials.stock_quantity` cache.
 *
 *   moveStock(tx, { materialId, type, qty, warehouseId, refType, refId, remarks, userId })
 *     -> updates material balance + inserts ledger row atomically.
 *
 * qty is SIGNED: GRN +, Issue −, Adjustment_In +, Adjustment_Out −, etc.
 */
const { eq } = require('drizzle-orm');
const { testMaterials, stockTransactions } = require('../db/schema');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Apply a signed stock movement inside the given transaction.
 * @param {import('drizzle-orm/mysql2').MySql2Transaction} tx
 */
async function moveStock(
  tx,
  { materialId, transactionType, qty, warehouseId = null, referenceType = null, referenceId = null, remarks = null, userId = null }
) {
  const [material] = await tx
    .select({ id: testMaterials.id, stockQuantity: testMaterials.stockQuantity })
    .from(testMaterials)
    .where(eq(testMaterials.id, materialId))
    .limit(1);

  if (!material) throw new Error(`Material ${materialId} not found.`);

  const delta = toNum(qty);
  const balanceAfter = round(toNum(material.stockQuantity) + delta);
  if (balanceAfter < 0) {
    throw new Error(`Insufficient stock for material ${materialId}.`);
  }

  await tx
    .update(testMaterials)
    .set({ stockQuantity: String(balanceAfter) })
    .where(eq(testMaterials.id, materialId));

  await tx.insert(stockTransactions).values({
    materialId,
    transactionType,
    qty: String(delta),
    balanceAfter: String(balanceAfter),
    warehouseId,
    referenceType,
    referenceId,
    remarks,
    createdBy: userId,
  });

  return balanceAfter;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

module.exports = { moveStock, round };
