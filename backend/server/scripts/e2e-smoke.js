/**
 * End-to-end smoke test for the Garments Factory ERP API.
 *
 * Creates a scratch database, applies the generated migrations, seeds demo
 * data, boots the real Express app, and exercises the REST endpoints across
 * all phases (auth, merchandising, MRP, procurement, warehouse, production,
 * shipping, dashboard). The scratch database is dropped when done.
 *
 * Run from the server/ directory:  node scripts/e2e-smoke.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const TEST_DB = `tmw_e2e_${Date.now()}`;
const API_PORT = 5998;

// Demo credentials are defined in db/seed.js - read them so tests stay in sync.
const seedSource = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.js'), 'utf8');
const DEMO_PASSWORD = (seedSource.match(/DEMO_PASSWORD = '([^']+)'/) || [])[1] || 'Admin@123';
const seedAdminBlock = seedSource.match(/\{ name: '[^']+', email: '([^']+)', role: 'Admin' \}/) || [];
const ADMIN_EMAIL = seedAdminBlock[1] || 'admin@factory.com';
const BASE_URL = `http://localhost:${API_PORT}`;
const ADMIN_URL = process.env.DATABASE_URL.replace(/[^/]+$/, ''); // scheme://user:pass@host:port/
const SCRATCH_URL = `${ADMIN_URL}${TEST_DB}`;

let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

const toNum = (v) => Number(v || 0);

async function main() {
  console.log('== Garments Factory ERP E2E smoke ==');
  console.log(`Scratch DB: ${TEST_DB}`);

  /* 1. Create scratch database */
  const admin = await mysql.createConnection(ADMIN_URL);
  await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  console.log('1. created scratch database');

  /* 2. Apply all migrations (0xxx then 1xxx) */
  const migrationDir = path.join(__dirname, '..', 'drizzle');
  const migrationFiles = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const conn = await mysql.createConnection(SCRATCH_URL);
  let applied = 0;
  for (const migrationFile of migrationFiles) {
    const migrationSql = fs.readFileSync(path.join(migrationDir, migrationFile), 'utf8');
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      if (statement.trim()) await conn.query(statement);
    }
    applied += 1;
  }
  const [tables] = await conn.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  await conn.end();
  check(`migrations applied (${applied} files) -> ${tables.length} tables`, tables.length >= 28, `got ${tables.length}`);

  /* 3. Seed */
  const seed = spawnSync('node', [path.join('db', 'seed.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: SCRATCH_URL },
    encoding: 'utf8',
  });
  check('seed script ran', seed.status === 0, seed.stderr);
  if (seed.stdout) {
    console.log('  ' + seed.stdout.split('\n').filter((l) => l.includes('[seed]')).join(' | '));
  }

  /* 4. Boot the API */
  const api = spawn('node', ['app.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: SCRATCH_URL, PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let apiOut = '';
  api.stdout.on('data', (d) => (apiOut += d));
  api.stderr.on('data', (d) => (apiOut += d));

  const waitForServer = async (attempts = 40) => {
    for (let i = 0; i < attempts; i += 1) {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) return true;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };
  check('API boots (health 200)', await waitForServer(), `\n${apiOut}`);

  const call = async (method, pathname, { token, body, formData } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE_URL}${pathname}`, { method, headers, body: payload });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, data };
  };

  /* 5. Auth */
  console.log('5. auth endpoints');
  const reg = await call('POST', '/api/auth/register', {
    body: { name: 'Public User', email: 'public@test.com', password: 'pass123', role: 'Admin' },
  });
  check('register returns 201', reg.status === 201);
  check('role escalation blocked (role=Store_Manager)', reg.data?.user?.role === 'Store_Manager', JSON.stringify(reg.data?.user));

  const noToken = await call('GET', '/api/materials');
  check('materials without token -> 401', noToken.status === 401);

  const adminLogin = await call('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: DEMO_PASSWORD } });
  check('admin login -> 200', adminLogin.status === 200, JSON.stringify(adminLogin.data));
  const adminToken = adminLogin.data?.token;
  check('admin token + role Admin', adminLogin.data?.user?.role === 'Admin');

  const qaLogin = await call('POST', '/api/auth/login', { body: { email: 'qa@factory.com', password: DEMO_PASSWORD } });
  const storeLogin = await call('POST', '/api/auth/login', { body: { email: 'store@factory.com', password: DEMO_PASSWORD } });

  /* 6. Materials (legacy) still work */
  console.log('6. material endpoints (legacy)');
  const list = await call('GET', '/api/materials', { token: adminToken });
  check('GET /materials -> 200', list.status === 200);
  check('seeded materials present', (list.data?.total || 0) >= 11, `total=${list.data?.total}`);

  /* 7. Phase 1: Buyers + Styles + BOM + Orders */
  console.log('7. Phase 1 - merchandising');
  const buyers = await call('GET', '/api/buyers', { token: adminToken });
  check('GET /buyers -> 200 with Columbia', buyers.status === 200 && buyers.data?.buyers?.some((b) => b.buyerCode === 'COL'));

  const styles = await call('GET', '/api/styles', { token: adminToken });
  check('GET /styles -> 200 with JK-1001', styles.status === 200 && styles.data?.styles?.some((s) => s.styleNumber === 'JK-1001'));
  const style = styles.data?.styles?.find((s) => s.styleNumber === 'JK-1001');

  const boms = await call('GET', `/api/styles/${style.id}/boms`, { token: adminToken });
  check('BOM versions listed (v1 Active)', boms.status === 200 && boms.data?.bomVersions?.some((v) => v.versionNo === 1 && v.status === 'Active'));
  const bom = boms.data?.bomVersions?.find((v) => v.versionNo === 1);
  const bomDetail = await call('GET', `/api/styles/boms/${bom.id}`, { token: adminToken });
  check('BOM v1 has 7 items (incl. thread/hangtag)', bomDetail.data?.items?.length === 7, `items=${bomDetail.data?.items?.length}`);

  const orders = await call('GET', '/api/orders', { token: adminToken });
  const colOrder = orders.data?.orders?.find((o) => o.orderNo === 'COL-2026-001');
  check('order COL-2026-001 seeded', !!colOrder);
  check('order has 3 lines', colOrder?.lineCount === 3, JSON.stringify(colOrder));
  check('order total qty 2300', colOrder?.totalQty === 2300, `qty=${colOrder?.totalQty}`);

  // Create a second order for the same style (multi-order support).
  const newOrder = await call('POST', '/api/orders', {
    token: adminToken,
    body: {
      buyerId: colOrder.buyerId,
      orderDate: '2026-02-01',
      deliveryDate: '2026-11-15',
      lines: [{ styleId: style.id, color: 'Olive', quantity: 500 }],
    },
  });
  check('POST /orders -> 201', newOrder.status === 201, JSON.stringify(newOrder.data));
  check('new order got SO number', /^SO-\d+$/.test(newOrder.data?.order?.orderNo || ''), newOrder.data?.order?.orderNo);

  const newOrderId = newOrder.data?.order?.id;
  const lineBomVersion = newOrder.data?.lines?.[0]?.bomVersionId;
  check('new order line auto-linked to active BOM v1', lineBomVersion === bom.id, `bomVersionId=${lineBomVersion}`);

  /* 8. Phase 2: MRP + reservation + PR */
  console.log('8. Phase 2 - MRP & planning');
  const mrp = await call('GET', `/api/mrp/orders/${colOrder.id}`, { token: adminToken });
  check('MRP computed -> 200', mrp.status === 200, JSON.stringify(mrp.data)?.slice(0, 200));
  const fabricReq = mrp.data?.requirements?.find((r) => r.materialCode === 'FBR-2401');
  // Order-level MRP: seeded order COL-2026-001 has 3 lines totalling 2300 pcs.
  // Shell fabric 1.80 m/pc -> gross 4140 m, +5% wastage -> net 4347 m.
  check('shell fabric gross 4140 m (2300 x 1.80)', fabricReq?.grossQty === 4140, `gross=${fabricReq?.grossQty}`);
  check('shell fabric net 4347 m (5% wastage)', fabricReq?.netQty === 4347, `net=${fabricReq?.netQty}`);

  const gen = await call('POST', `/api/mrp/orders/${colOrder.id}/generate`, { token: adminToken });
  check('MRP generate (persist) -> 200', gen.status === 200, JSON.stringify(gen.data)?.slice(0, 200));

  const reserve = await call('POST', `/api/mrp/orders/${colOrder.id}/reserve`, { token: adminToken });
  check('reserve -> 200', reserve.status === 200, JSON.stringify(reserve.data));

  const overview = await call('GET', '/api/stock/overview', { token: adminToken });
  const fabricStock = overview.data?.materials?.find((m) => m.materialCode === 'FBR-2401');
  check('reserved reflects in stock overview', toNum(fabricStock?.reserved) > 0, JSON.stringify(fabricStock));

  const pr = await call('POST', `/api/requisitions/from-mrp/${colOrder.id}`, { token: adminToken });
  check('PR generated from MRP shortage -> 201', pr.status === 201, JSON.stringify(pr.data)?.slice(0, 200));
  const prId = pr.data?.requisition?.id;
  check('PR has shortage items', (pr.data?.items?.length || 0) > 0, `items=${pr.data?.items?.length}`);

  const prApprove = await call('POST', `/api/requisitions/${prId}/status`, { token: adminToken, body: { status: 'Approved' } });
  check('PR approved -> 200', prApprove.status === 200);

  /* 9. Phase 3: Supplier link + PO + GRN + ledger */
  console.log('9. Phase 3 - procurement & warehouse');
  const matList = await call('GET', '/api/materials', { token: adminToken });
  const fabric = matList.data?.materials?.find((m) => m.materialCode === 'FBR-2401');

  const link = await call('POST', '/api/suppliers/supplier-materials', {
    token: adminToken,
    body: { supplierId: 1, materialId: fabric.id, moq: 100, unitPrice: 4.5, leadTimeDays: 12, isPreferred: true },
  });
  check('supplier-material link -> 201', link.status === 201, JSON.stringify(link.data));

  // PO from the approved PR.
  const po = await call('POST', `/api/purchase-orders/from-pr/${prId}`, {
    token: adminToken,
    body: { supplierId: 1, deliveryDate: '2026-09-05' },
  });
  check('PR -> PO conversion -> 201', po.status === 201, JSON.stringify(po.data)?.slice(0, 200));
  const poId = po.data?.purchaseOrder?.id;
  check('PO status Approved', po.data?.purchaseOrder?.status === 'Approved', po.data?.purchaseOrder?.status);

  // Receive goods against the PO.
  const firstPoItem = po.data?.items?.[0];
  const receiveQty = toNum(firstPoItem.qty);
  const grn = await call('POST', '/api/grn', {
    token: adminToken,
    body: {
      poId,
      receivedDate: '2026-09-01',
      warehouseId: 1,
      items: [{ materialId: firstPoItem.materialId, receivedQty: receiveQty, acceptedQty: receiveQty, rejectedQty: 0 }],
    },
  });
  check('GRN -> 201', grn.status === 201, JSON.stringify(grn.data)?.slice(0, 200));

  const ledger = await call('GET', '/api/stock/ledger', { token: adminToken });
  check('ledger has GRN transaction', ledger.data?.transactions?.some((t) => t.transactionType === 'GRN'), JSON.stringify(ledger.data?.transactions?.[0]));

  const overviewAfter = await call('GET', '/api/stock/overview', { token: adminToken });
  const fabricAfter = overviewAfter.data?.materials?.find((m) => m.materialCode === 'FBR-2401');
  check('stock increased after GRN', toNum(fabricAfter?.physical) > toNum(fabricStock?.physical), `before=${fabricStock?.physical} after=${fabricAfter?.physical}`);

  const poList = await call('GET', '/api/purchase-orders', { token: adminToken });
  check('PO list shows receive progress', poList.data?.purchaseOrders?.some((p) => p.id === poId && toNum(p.receivedQty) > 0));

  // Adjustment flow.
  const adj = await call('POST', '/api/stock/adjustments', {
    token: adminToken,
    body: { materialId: fabric.id, qty: -10, reason: 'damaged roll E2E' },
  });
  check('adjustment requested -> 201', adj.status === 201, JSON.stringify(adj.data));
  const adjId = adj.data?.adjustment?.id;
  const adjApprove = await call('POST', `/api/stock/adjustments/${adjId}/approve`, { token: adminToken });
  check('adjustment approved -> 200', adjApprove.status === 200);

  /* 10. Phase 4: Production + issue + cutting + output */
  console.log('10. Phase 4 - production');
  const prod = await call('POST', '/api/production', {
    token: adminToken,
    body: { salesOrderLineId: newOrder.data?.lines?.[0]?.id, qty: 500, line: 'Line 3' },
  });
  check('production order created -> 201', prod.status === 201, JSON.stringify(prod.data)?.slice(0, 200));
  const prodId = prod.data?.productionOrder?.id;

  const mi = await call('POST', '/api/issues', {
    token: adminToken,
    body: { productionOrderId: prodId, warehouseId: 1, items: [{ materialId: fabric.id, requestedQty: 20 }] },
  });
  check('material issue requested -> 201', mi.status === 201, JSON.stringify(mi.data));
  const miId = mi.data?.issue?.id;
  const miItems = mi.data?.items;

  const miIssue = await call('POST', `/api/issues/${miId}/status`, {
    token: adminToken,
    body: { status: 'Issued', issuedItems: { [miItems[0].id]: 20 } },
  });
  check('issue stock -> 200', miIssue.status === 200, JSON.stringify(miIssue.data)?.slice(0, 200));

  const ledgerAfterIssue = await call('GET', '/api/stock/ledger', { token: adminToken });
  check('ledger has Issue transaction', ledgerAfterIssue.data?.transactions?.some((t) => t.transactionType === 'Issue'));

  const cutting = await call('POST', '/api/cutting', {
    token: adminToken,
    body: { productionOrderId: prodId, markerNo: 'MK-01', cutQty: 500 },
  });
  check('cutting plan created -> 201', cutting.status === 201, JSON.stringify(cutting.data)?.slice(0, 200));
  const cpId = cutting.data?.plan?.id;

  const output = await call('POST', `/api/production/${prodId}/output`, {
    token: adminToken,
    body: { stage: 'Finishing_Output', qty: 480, rejectionQty: 5 },
  });
  check('production output recorded -> 201', output.status === 201, JSON.stringify(output.data));

  const prodList = await call('GET', '/api/production', { token: adminToken });
  const prodRow = prodList.data?.productionOrders?.find((p) => p.id === prodId);
  check('WIP computed (500-480=20)', prodRow?.wip === 20, JSON.stringify(prodRow));

  /* 11. Phase 5: QC + FG + shipment + dashboard */
  console.log('11. Phase 5 - quality, FG, shipment, dashboard');
  const qc = await call('POST', '/api/quality', {
    token: qaLogin.data?.token,
    body: { referenceType: 'End_Line', productionOrderId: prodId, result: 'Passed', defectQty: 5 },
  });
  check('quality check -> 201', qc.status === 201, JSON.stringify(qc.data));

  const fg = await call('POST', '/api/shipping/finished-goods', {
    token: adminToken,
    body: { productionOrderId: prodId, color: 'Olive', size: 'M', qty: 480, cartonNo: 'CTN-01' },
  });
  check('finished goods -> 201', fg.status === 201, JSON.stringify(fg.data));

  const shipment = await call('POST', '/api/shipping/shipments', {
    token: adminToken,
    body: {
      salesOrderId: newOrderId,
      destination: 'Portland, OR, USA',
      shipmentDate: '2026-11-01',
      items: [{ salesOrderLineId: newOrder.data?.lines?.[0]?.id, qty: 480, cartons: 24 }],
    },
  });
  check('shipment planned -> 201', shipment.status === 201, JSON.stringify(shipment.data)?.slice(0, 200));
  const shipId = shipment.data?.shipment?.id;
  const shipStatus = await call('POST', `/api/shipping/shipments/${shipId}/status`, { token: adminToken, body: { status: 'Shipped' } });
  check('shipment status -> Shipped', shipStatus.status === 200 && shipStatus.data?.shipment?.status === 'Shipped');

  const dash = await call('GET', '/api/dashboard/summary', { token: adminToken });
  check('dashboard summary -> 200', dash.status === 200, JSON.stringify(dash.data)?.slice(0, 200));
  check('dashboard has sales.openOrders', typeof dash.data?.sales?.openOrders === 'number');
  check('dashboard has production.wip', typeof dash.data?.production?.wip === 'number');

  /* 12. RBAC sanity on new routes */
  const storeDenied = await call('POST', '/api/buyers', { token: storeLogin.data?.token, body: { buyerCode: 'X', buyerName: 'X' } });
  check('Store_Manager cannot create buyer -> 403', storeDenied.status === 403);

  /* 13. Cleanup */
  api.kill();
  const admin2 = await mysql.createConnection(ADMIN_URL);
  await admin2.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await admin2.end();

  console.log('12. scratch database dropped');
  console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
