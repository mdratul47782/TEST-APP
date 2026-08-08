/**
 * Quality routes - production QC checkpoints.
 *
 *   GET  /api/quality?productionOrderId=   list checks
 *   POST /api/quality                      record a check
 *   GET  /api/quality/stats                defect summary
 */
const { Router } = require('express');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  qualityChecks,
  productionOrders,
  users,
  QC_TYPES,
  QC_RESULTS,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');
const { nextDocNo } = require('../utils/docNo');

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const { productionOrderId } = req.query;
  let query = db
    .select({
      id: qualityChecks.id,
      checkNo: qualityChecks.checkNo,
      referenceType: qualityChecks.referenceType,
      productionOrderId: qualityChecks.productionOrderId,
      productionOrderNo: productionOrders.productionOrderNo,
      checkedByName: users.name,
      result: qualityChecks.result,
      defectCode: qualityChecks.defectCode,
      defectQty: qualityChecks.defectQty,
      remarks: qualityChecks.remarks,
      checkedAt: qualityChecks.checkedAt,
    })
    .from(qualityChecks)
    .leftJoin(productionOrders, eq(qualityChecks.productionOrderId, productionOrders.id))
    .leftJoin(users, eq(qualityChecks.checkedBy, users.id))
    .orderBy(desc(qualityChecks.checkedAt));

  if (productionOrderId) query = query.where(eq(qualityChecks.productionOrderId, Number(productionOrderId)));
  const rows = await query;
  return res.json({ checks: rows, total: rows.length });
});

router.post('/', authenticate, authorize('Admin', 'QA_Inspector'), async (req, res) => {
  const { referenceType, referenceId, productionOrderId, result, defectCode, defectQty, remarks } = req.body || {};
  if (!referenceType || !QC_TYPES.includes(referenceType)) {
    return res.status(400).json({ message: `referenceType must be one of: ${QC_TYPES.join(', ')}.` });
  }
  if (!result || !QC_RESULTS.includes(result)) {
    return res.status(400).json({ message: `result must be one of: ${QC_RESULTS.join(', ')}.` });
  }
  const checkNo = await nextDocNo(db, 'QC');
  const [inserted] = await db.insert(qualityChecks).values({
    checkNo,
    referenceType,
    referenceId: referenceId ? Number(referenceId) : null,
    productionOrderId: productionOrderId ? Number(productionOrderId) : null,
    checkedBy: req.user.id,
    result,
    defectCode: defectCode || null,
    defectQty: Number(defectQty) || 0,
    remarks: remarks || null,
  });
  const [row] = await db.select().from(qualityChecks).where(eq(qualityChecks.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: `${checkNo} recorded.`, check: row });
});

router.get('/stats', authenticate, async (req, res) => {
  const rows = await db.select().from(qualityChecks);
  const stats = {
    total: rows.length,
    passed: rows.filter((r) => r.result === 'Passed').length,
    failed: rows.filter((r) => r.result === 'Failed').length,
    rework: rows.filter((r) => r.result === 'Rework').length,
    totalDefects: rows.reduce((s, r) => s + (r.defectQty || 0), 0),
  };
  return res.json({ stats });
});

module.exports = router;
