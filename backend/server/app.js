/**
 * Test Material Warehouse - Express.js API server (Express 5).
 *
 * Boot order: environment -> middleware -> routes -> 404 -> error handler.
 * All DB queries run through Drizzle ORM (see ./config/db.js).
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');

const authRoutes = require('./routes/authRoutes');
const materialRoutes = require('./routes/materialRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const styleRoutes = require('./routes/styleRoutes');
const orderRoutes = require('./routes/orderRoutes');
const mrpRoutes = require('./routes/mrpRoutes');
const requisitionRoutes = require('./routes/requisitionRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const grnRoutes = require('./routes/grnRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const productionRoutes = require('./routes/productionRoutes');
const issueRoutes = require('./routes/issueRoutes');
const cuttingRoutes = require('./routes/cuttingRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

/* ------------------------------ Middleware ----------------------------- */

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '2mb' }));

/* ------------------------------ Health check --------------------------- */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'test-material-warehouse-api',
    time: new Date().toISOString(),
  });
});

/* -------------------------------- Routes ------------------------------- */

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/styles', styleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/mrp', mrpRoutes);
app.use('/api/requisitions', requisitionRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/grn', grnRoutes);
app.use('/api/stock', warehouseRoutes); // /ledger /overview /adjustments /fabric-rolls /warehouses
app.use('/api/production', productionRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/cutting', cuttingRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/shipping', shippingRoutes); // /finished-goods /shipments
app.use('/api/dashboard', dashboardRoutes);

/* ------------------------------ 404 handler ---------------------------- */

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

/* ----------------------------- Error handler --------------------------- */

// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'Uploaded file exceeds the 10 MB limit.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Expected field name: "document".',
    };
    return res.status(400).json({ message: messages[err.code] || `Upload error: ${err.message}` });
  }

  if (err.http_code && err.message) {
    return res.status(400).json({ message: `Cloudinary upload failed: ${err.message}` });
  }

  return res.status(err.status || 500).json({
    message: err.status ? err.message : 'Internal server error. Please try again later.',
  });
});

/* -------------------------------- Listen ------------------------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Test Material Warehouse API running on http://localhost:${PORT}`);
});
