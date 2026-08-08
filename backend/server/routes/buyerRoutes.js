/**
 * Buyer routes (CRUD).
 *
 *   GET    /api/buyers
 *   GET    /api/buyers/:id
 *   POST   /api/buyers
 *   PUT    /api/buyers/:id
 *   DELETE /api/buyers/:id   (soft deactivate if referenced)
 */
const { Router } = require('express');
const { eq, asc } = require('drizzle-orm');
const { db } = require('../config/db');
const { buyers } = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const rows = await db.select().from(buyers).orderBy(asc(buyers.buyerName));
  return res.json({ buyers: rows, total: rows.length });
});

router.get('/:id', authenticate, async (req, res) => {
  const [row] = await db.select().from(buyers).where(eq(buyers.id, Number(req.params.id))).limit(1);
  if (!row) return res.status(404).json({ message: 'Buyer not found.' });
  return res.json({ buyer: row });
});

router.post('/', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const { buyerCode, buyerName, contactPerson, email, phone, address, paymentTerms, shippingTerms, currency, isActive } = req.body || {};
  if (!buyerCode || !buyerName) {
    return res.status(400).json({ message: 'buyerCode and buyerName are required.' });
  }
  const existing = await db.select({ id: buyers.id }).from(buyers).where(eq(buyers.buyerCode, buyerCode)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ message: `Buyer code "${buyerCode}" already exists.` });
  }
  const [inserted] = await db.insert(buyers).values({
    buyerCode,
    buyerName,
    contactPerson: contactPerson || null,
    email: email || null,
    phone: phone || null,
    address: address || null,
    paymentTerms: paymentTerms || null,
    shippingTerms: shippingTerms || null,
    currency: currency || 'USD',
    isActive: isActive === undefined ? true : Boolean(isActive),
  });
  const [row] = await db.select().from(buyers).where(eq(buyers.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Buyer created.', buyer: row });
});

router.put('/:id', authenticate, authorize('Admin', 'Merchandiser'), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select({ id: buyers.id }).from(buyers).where(eq(buyers.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Buyer not found.' });

  const { buyerName, contactPerson, email, phone, address, paymentTerms, shippingTerms, currency, isActive } = req.body || {};
  await db.update(buyers).set({
    ...(buyerName ? { buyerName } : {}),
    ...(contactPerson !== undefined ? { contactPerson } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(paymentTerms !== undefined ? { paymentTerms } : {}),
    ...(shippingTerms !== undefined ? { shippingTerms } : {}),
    ...(currency ? { currency } : {}),
    ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
  }).where(eq(buyers.id, id));

  const [row] = await db.select().from(buyers).where(eq(buyers.id, id)).limit(1);
  return res.json({ message: 'Buyer updated.', buyer: row });
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select({ id: buyers.id }).from(buyers).where(eq(buyers.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Buyer not found.' });
  // Soft-delete: keep history safe.
  await db.update(buyers).set({ isActive: false }).where(eq(buyers.id, id));
  return res.json({ message: 'Buyer deactivated.' });
});

module.exports = router;
