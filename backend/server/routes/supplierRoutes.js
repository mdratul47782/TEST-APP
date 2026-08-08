/**
 * Supplier routes - CRUD + supplier-material catalog (MOQ/lead time/price)
 * + price history.
 *
 *   GET    /api/suppliers                 list suppliers (optionally ?materialId=)
 *   POST   /api/suppliers                 create
 *   PUT    /api/suppliers/:id             update
 *   DELETE /api/suppliers/:id             soft deactivate
 *   GET    /api/suppliers/:id/materials   materials supplied by this supplier
 *   POST   /api/supplier-materials        link supplier ↔ material
 *   PUT    /api/supplier-materials/:id    update MOQ/price/lead time
 *   GET    /api/supplier-materials/for/:materialId  suppliers for a material
 */
const { Router } = require('express');
const { eq, asc, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  suppliers,
  testMaterials,
  supplierMaterials,
  supplierPriceHistory,
} = require('../db/schema');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

/* ------------------------------ CRUD -------------------------------- */

router.get('/', authenticate, async (req, res) => {
  const { materialId } = req.query;
  if (materialId) {
    const rows = await db
      .select({
        id: suppliers.id,
        supplierCode: suppliers.supplierCode,
        supplierName: suppliers.supplierName,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
        email: suppliers.email,
        rating: suppliers.rating,
        isActive: suppliers.isActive,
        materialId: supplierMaterials.materialId,
        moq: supplierMaterials.moq,
        unitPrice: supplierMaterials.unitPrice,
        leadTimeDays: supplierMaterials.leadTimeDays,
        isPreferred: supplierMaterials.isPreferred,
      })
      .from(supplierMaterials)
      .innerJoin(suppliers, eq(supplierMaterials.supplierId, suppliers.id))
      .where(eq(supplierMaterials.materialId, Number(materialId)))
      .orderBy(desc(supplierMaterials.isPreferred), asc(supplierMaterials.leadTimeDays));
    return res.json({ suppliers: rows, total: rows.length });
  }

  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.supplierName));
  return res.json({ suppliers: rows, total: rows.length });
});

router.post('/', authenticate, authorize('Admin', 'Procurement', 'Store_Manager'), async (req, res) => {
  const {
    supplierCode, supplierName, contactPerson, phone, email, address,
    paymentTerms, shippingTerms, rating, isActive,
  } = req.body || {};
  if (!supplierName) return res.status(400).json({ message: 'supplierName is required.' });

  const [inserted] = await db.insert(suppliers).values({
    supplierCode: supplierCode || null,
    supplierName,
    contactPerson: contactPerson || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    paymentTerms: paymentTerms || null,
    shippingTerms: shippingTerms || null,
    rating: rating ? Number(rating) : null,
    isActive: isActive === undefined ? true : Boolean(isActive),
  });
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Supplier created.', supplier: row });
});

router.put('/:id', authenticate, authorize('Admin', 'Procurement', 'Store_Manager'), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Supplier not found.' });

  const {
    supplierCode, supplierName, contactPerson, phone, email, address,
    paymentTerms, shippingTerms, rating, isActive,
  } = req.body || {};
  await db.update(suppliers).set({
    ...(supplierCode !== undefined ? { supplierCode } : {}),
    ...(supplierName ? { supplierName } : {}),
    ...(contactPerson !== undefined ? { contactPerson } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(paymentTerms !== undefined ? { paymentTerms } : {}),
    ...(shippingTerms !== undefined ? { shippingTerms } : {}),
    ...(rating !== undefined ? { rating: rating ? Number(rating) : null } : {}),
    ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
  }).where(eq(suppliers.id, id));

  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return res.json({ message: 'Supplier updated.', supplier: row });
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, Number(req.params.id)));
  return res.json({ message: 'Supplier deactivated.' });
});

/* ------------------------- Supplier materials ------------------------ */

router.get('/:id/materials', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: supplierMaterials.id,
      materialId: supplierMaterials.materialId,
      materialCode: testMaterials.materialCode,
      materialName: testMaterials.materialName,
      unit: testMaterials.unit,
      moq: supplierMaterials.moq,
      unitPrice: supplierMaterials.unitPrice,
      leadTimeDays: supplierMaterials.leadTimeDays,
      isPreferred: supplierMaterials.isPreferred,
      isActive: supplierMaterials.isActive,
    })
    .from(supplierMaterials)
    .innerJoin(testMaterials, eq(supplierMaterials.materialId, testMaterials.id))
    .where(eq(supplierMaterials.supplierId, Number(req.params.id)));
  return res.json({ items: rows, total: rows.length });
});

router.post('/supplier-materials', authenticate, authorize('Admin', 'Procurement'), async (req, res) => {
  const { supplierId, materialId, moq, unitPrice, leadTimeDays, isPreferred } = req.body || {};
  if (!supplierId || !materialId) {
    return res.status(400).json({ message: 'supplierId and materialId are required.' });
  }
  const existing = await db
    .select({ id: supplierMaterials.id })
    .from(supplierMaterials)
    .where(eq(supplierMaterials.supplierId, Number(supplierId)))
    .where(eq(supplierMaterials.materialId, Number(materialId)))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ message: 'This supplier-material link already exists.' });
  }
  const [inserted] = await db.insert(supplierMaterials).values({
    supplierId: Number(supplierId),
    materialId: Number(materialId),
    moq: moq !== undefined && moq !== '' ? String(moq) : null,
    unitPrice: unitPrice !== undefined && unitPrice !== '' ? String(unitPrice) : null,
    leadTimeDays: leadTimeDays !== undefined && leadTimeDays !== '' ? Number(leadTimeDays) : null,
    isPreferred: Boolean(isPreferred),
  });

  // Record the price in history for auditing.
  if (unitPrice !== undefined && unitPrice !== '') {
    await db.insert(supplierPriceHistory).values({
      supplierId: Number(supplierId),
      materialId: Number(materialId),
      unitPrice: String(unitPrice),
      priceDate: new Date().toISOString().slice(0, 10),
    });
  }

  const [row] = await db.select().from(supplierMaterials).where(eq(supplierMaterials.id, inserted.insertId)).limit(1);
  return res.status(201).json({ message: 'Supplier-material link created.', item: row });
});

router.put('/supplier-materials/:id', authenticate, authorize('Admin', 'Procurement'), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(supplierMaterials).where(eq(supplierMaterials.id, id)).limit(1);
  if (!existing) return res.status(404).json({ message: 'Link not found.' });

  const { moq, unitPrice, leadTimeDays, isPreferred, isActive } = req.body || {};
  await db.update(supplierMaterials).set({
    ...(moq !== undefined ? { moq: moq !== '' ? String(moq) : null } : {}),
    ...(unitPrice !== undefined ? { unitPrice: unitPrice !== '' ? String(unitPrice) : null } : {}),
    ...(leadTimeDays !== undefined ? { leadTimeDays: leadTimeDays !== '' ? Number(leadTimeDays) : null } : {}),
    ...(isPreferred !== undefined ? { isPreferred: Boolean(isPreferred) } : {}),
    ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
  }).where(eq(supplierMaterials.id, id));

  if (unitPrice !== undefined && unitPrice !== '') {
    await db.insert(supplierPriceHistory).values({
      supplierId: existing.supplierId,
      materialId: existing.materialId,
      unitPrice: String(unitPrice),
      priceDate: new Date().toISOString().slice(0, 10),
    });
  }

  const [row] = await db.select().from(supplierMaterials).where(eq(supplierMaterials.id, id)).limit(1);
  return res.json({ message: 'Link updated.', item: row });
});

router.get('/supplier-materials/for/:materialId', authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: supplierMaterials.id,
      supplierId: suppliers.id,
      supplierName: suppliers.supplierName,
      rating: suppliers.rating,
      moq: supplierMaterials.moq,
      unitPrice: supplierMaterials.unitPrice,
      leadTimeDays: supplierMaterials.leadTimeDays,
      isPreferred: supplierMaterials.isPreferred,
    })
    .from(supplierMaterials)
    .innerJoin(suppliers, eq(supplierMaterials.supplierId, suppliers.id))
    .where(eq(supplierMaterials.materialId, Number(req.params.materialId)))
    .orderBy(desc(supplierMaterials.isPreferred), asc(supplierMaterials.leadTimeDays));
  return res.json({ suppliers: rows });
});

module.exports = router;
