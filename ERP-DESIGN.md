# Garments Factory ERP — Design & Implementation Plan

> Companion document to the existing Test Material Warehouse app (Next.js 15 App Router + Express 5 + MySQL/Drizzle ORM + JWT + Cloudinary).
> This document is the **approved design before any major code changes**. Implementation follows the phased plan in §7, one module at a time.

---

## 1. Current System Analysis (what exists today)

### 1.1 Database (Drizzle, `backend/server/db/schema.js`) — 4 tables

| Table | Columns | Notes |
|---|---|---|
| `users` | id, name, email, password (bcrypt), role enum (`Admin, Store_Manager, QA_Inspector, Merchandiser`), created_at | JWT stateless auth, no sessions |
| `suppliers` | id, supplier_name, contact_person, phone, email, created_at | Minimal vendor master |
| `test_materials` | id, material_code (unique), material_name, category enum (Fabric/Trim/Accessory/Webbing/Elastic/Zipper), supplier_id FK, stock_quantity (int), unit, rack_location, test_status enum (Pending/Passed/Failed), document_url (Cloudinary), created_at | The material master + single physical-stock counter |
| `material_test_logs` | id, material_id FK (cascade), tested_by FK (set null), test_result, remarks, tested_at | QA audit trail |

Existing FKs: `test_materials.supplier_id → suppliers`, `material_test_logs.material_id → test_materials`, `material_test_logs.tested_by → users`.

### 1.2 Backend routes (Express 5, `backend/server/`)

| Route | Method | Auth | Behavior |
|---|---|---|---|
| `/api/auth/register`, `/api/auth/login` | POST | public | bcrypt + JWT; role honored only for Admin; 30d token |
| `/api/materials` | GET | token | materials left-joined with supplier name + latest test log |
| `/api/materials` | POST | Admin/Store_Manager | multipart, Cloudinary cert upload (`req.file.path`), validation, duplicate check, orphaned-asset cleanup |
| `/api/materials/:id/status` | PUT | Admin/QA_Inspector | status update + audit log insert inside one `db.transaction` |
| `/api/suppliers` | GET | token | list suppliers for dropdowns |

Infrastructure: `config/db.js` (mysql2 pool + `drizzle(pool, { schema, mode: 'default' })`), `config/cloudinary.js` (multer-storage-cloudinary, 10 MB), `middleware/auth.js` (`authenticate` + `authorize(...roles)`), `app.js` (CORS, JSON, 404, centralized error handler incl. multer/Cloudinary errors), migration `drizzle/0000_shocking_manta.sql`, idempotent `db/seed.js`, and a 26-check `scripts/e2e-smoke.js`.

### 1.3 Frontend (Next.js 15 App Router + Tailwind v4, `frontend/`)

- `app/page.jsx` — login/register (brand panel, toggle, show/hide password, redirect if authed).
- `app/dashboard/page.jsx` — material warehouse: stats cards, low-stock alert, search + category/status filters + sorting, responsive table with color-coded status badges, Cloudinary report links, add-material modal, update-status modal, toasts, skeletons, empty states, role-gated buttons.
- `utils/api.js` — Bearer-token injection from localStorage, 401 auto-logout, error shaping.
- Component style: client components, `lucide-react` icons, Tailwind utility classes, indigo/violet gradient accents, rounded-2xl cards, `animate-fade-in-up` micro-interactions.

### 1.4 What must be preserved

- All existing routes/pages continue to work unchanged (auth, materials CRUD, QA flow, suppliers).
- `test_materials` remains the **material master** — new modules reference it, never duplicate it.
- The QA test-status flow (`material_test_logs`) is kept and becomes the **material receiving QC** checkpoint.
- Existing coding style (CJS Express, Drizzle `mysql-core`, client components, `api` util, toasts) is reused; no new libraries beyond what is already installed.

---

## 2. Validated Business Workflow (consultant view)

The requested flow is correct and complete for a woven/outerwear garments factory. Confirmed, with the additions marked **NEW**:

```
BUYER ORDER (PO from Columbia/Decathlon/Walmart)
   │  [tech pack: style, colors, sizes, qty, delivery date, FOB terms]
   ▼
MERCHANDISING — Order Booking (multi-line: color × qty × size breakdown)
   │
   ▼
STYLE MASTER (design/development) + VERSIONED BOM (consumption per piece)
   │
   ▼
MRP: OrderQty × BOM consumption × (1 + wastage%)  ──►  NET REQUIREMENT per material
   │
   ▼
STOCK CHECK:  Physical − Reserved(others) + Incoming(PO)  vs  Requirement
   │
   ├── Enough ──► RESERVE material to the order
   └── Shortage ──► PURCHASE REQUISITION → Approval → PURCHASE ORDER → Supplier
                          │                                    │
                          ▼                                    ▼
                    Material Warehouse                 GRN / Receiving + Material QC
                    (roll-level fabric)                 (accepted → stock in; rejected → return)
                          │                                    ▲
                          └───────── NEW: Stock Transaction Ledger ──┘
                          │
   PRODUCTION ORDER (per order line)
      │ Material Issue (MI) → reservation released, stock down
      ▼
   CUTTING (plan, marker/lay, bundle) → SEWING (line, input/output) → FINISHING (inspection, packing)
      │
      ▼
   FINISHED GOODS warehouse (color × size × cartons)
      │
      ▼
   SHIPMENT planning → dispatch (cartons, destination, docs)
```

### 2.1 Processes the request implied but should be explicit (added by the consultant)

1. **Document numbering** — PR-00001, PO-00025, GRN-00018, MI-00015, SH-00007. A small `document_sequences` counter table generates race-safe numbers per prefix.
2. **Approval gates** — PR needs approval before PO; stock adjustments need approval; material issues need warehouse approval. Role-based status transitions, not free-form edits.
3. **Reservation lifecycle** — reservations are created on order confirmation, released on material issue, and cancelled on order cancellation. "Available" must never include reserved stock.
4. **Stock is only ever changed by transactions** — the `stock_transactions` ledger is the single source of truth; `test_materials.stock_quantity` becomes a maintained cache updated in the same DB transaction (so the existing frontend keeps working).
5. **Roll-level fabric tracking** — fabric lives as rolls (roll no, length, width, shade, batch/lot, GSM) for shade continuity in cutting.
6. **Fabric decimals** — `stock_quantity` changes from `int` to `decimal(12,3)` because meters matter at 0.5 m resolution.
7. **Multi-currency** — buyers/orders/POs carry a currency code (USD/BDT/EUR); costs stay in PO currency.
8. **SMV + production line** — SMV on the style, line/floor on the production order (full capacity planning is a later extension, not Phase 1–5 scope).
9. **Order amendments** — delivery-date/qty changes are tracked as an amendment log (light; core workflow unaffected).
10. **Roles** — recommend adding `Production_Manager` and `Procurement` to the role enum (additive). If you prefer to keep exactly 4 roles, duties map onto `Store_Manager`/`Merchandiser` — see §8 decision D1.

### 2.2 How the ERP answers your 25 management questions

| # | Question | Answered by |
|---|---|---|
| 1 | Orders booked? | `sales_orders` (status) |
| 2 | Which buyer? | `sales_orders.buyer_id → buyers` |
| 3 | Which style? | `sales_order_lines.style_id → styles` |
| 4 | Order quantity? | `sales_order_lines.quantity` (per color) |
| 5 | Materials required? | `bom_items` of the order's BOM version |
| 6 | BOM for style? | `bom_versions` + `bom_items` |
| 7 | Requirement per order? | `material_requirements` (net = qty × consumption × (1+wastage)) |
| 8 | Stock in warehouse? | `test_materials.stock_quantity` (ledger-maintained) |
| 9 | Reserved for others? | `material_reservations` (Active) per material |
| 10 | Available to use? | Physical − all active reservations |
| 11 | Shortage? | `max(0, net − available − incoming)` |
| 12–14 | What to buy, how much, from whom? | MRP shortage → suggested qty (rounded to preferred-supplier MOQ) + suggested supplier (BOM preference → `supplier_materials`) |
| 15 | Pending POs? | `purchase_orders` status |
| 16–17 | Arrived / pending? | `purchase_order_items.received_qty` vs `qty`; GRNs |
| 18 | Issued to production? | `material_issues` + ledger Issue rows |
| 19 | Remaining in warehouse? | Physical balance after issues |
| 20 | Orders delayed by shortage? | MRP shortage > 0 ∧ delivery date near/passed → flagged in production/dashboard |
| 21–24 | Ready for cutting / in cutting / sewing / finishing? | `production_orders.status` + `production_output` per stage |
| 25 | Ready for shipment? | `finished_goods` qty vs order line qty → `shipments` status |

---

## 3. Module Architecture (mapped to the request)

| Module | Request area | Phase |
|---|---|---|
| Buyers | §1 Buyer Management | 1 |
| Styles (+ sizes/colors) | §2 Style/Product | 1 |
| Sales Orders (booking, multi-line, size breakdown) | §3 Sales/Order Booking | 1 |
| BOM + versioning | §4 BOM Management | 1 |
| MRP engine (requirement calc service) | §5 Material Requirement Planning | 2 |
| Material Reservation | §6 Material Reservation | 2 |
| Stock Availability view | §5/§11 | 2 |
| Purchase Requisition (+ approval) | §7 Purchase Requisition | 2 |
| Suppliers extended (MOQ, lead time, price history, rating) | §8 Supplier Management | 3 |
| Purchase Order (+ PR conversion, receiving progress) | §9 Purchase Order | 3 |
| GRN + material receiving QC | §10 Goods Receiving | 3 |
| Warehouse: stock ledger, adjustments, fabric rolls | §11 Material Warehouse | 3 |
| Material Issue to Production | §12 Material Issue | 4 |
| Cutting (plan, marker/lay, bundles) | §13 Cutting | 4 |
| Sewing / Production (line, input/output, WIP) | §14 Sewing/Production | 4 |
| Finishing (inspection → packing) | §15 Finishing | 4 |
| Quality checkpoints | §16 Quality | 5 |
| Finished Goods warehouse | §17 FG Warehouse | 5 |
| Shipment planning & tracking | §18 Shipment | 5 |
| Management Dashboard (Sales/Material/Purchase/Production/Shipment KPIs) | §19 Dashboard | 5 (light version at end of each phase) |

---

## 4. Database Design (full entity catalog)

Conventions: `int` PK autoincrement, `timestamp defaultNow` on every table (`created_at`), camelCase→snake_case Drizzle columns, FKs with `onDelete` rules as noted, all money/quantity as `decimal`, document numbers unique. `mysqlEnum` reused for statuses. **Existing 4 tables are extended, never recreated.**

### Phase 1 — Merchandising (Buyers → Styles → Orders → BOM)

**`buyers`** *(new)*
`id, buyer_code (unique, e.g. COL), buyer_name, contact_person, email, phone, address, payment_terms, shipping_terms, currency (varchar 3, default USD), is_active (bool), created_at`

**`styles`** *(new)* — belongs to a buyer
`id, style_number (unique, e.g. JK-1001), product_name, category (Outerwear/Knit/…) , season (e.g. FW26), buyer_id FK (set null), smv decimal(8,3), size_range (JSON array), color_range (JSON array), production_route (text), status (Active/Inactive), created_at`

**`sales_orders`** *(new)*
`id, order_no (unique, e.g. COL-2026-001), buyer_id FK, order_date, delivery_date, currency, order_status (Draft/Booked/Confirmed/In_Production/Completed/Cancelled), priority (Normal/High/Urgent), remarks, created_by FK users, created_at`
*Amendment log:* `order_amendments` (id, order_id FK, field, old_value, new_value, amended_by, amended_at) — light.

**`sales_order_lines`** *(new)* — one row per color
`id, order_id FK (cascade), style_id FK, color, quantity (int), size_breakdown (JSON: {S:100, M:400,…}), unit_price decimal(12,2), bom_version_id FK (nullable → set at booking), line_status (Booked/In_Production/Completed/Cancelled), created_at`
- **Multiple orders, same style:** each line carries its own qty, delivery, BOM version, reservation, PR, production order — while the style's BOM stays shared via `bom_version_id`. No duplicate BOMs. ✔

**`bom_versions`** *(new)* — versioning per style
`id, style_id FK (cascade), version_no (int), status (Draft/Active/Superseded), remarks, created_at, unique(style_id, version_no)`
*Rule:* an order locks the version it uses. Editing an Active version that orders reference requires creating a new version (old one is superseded but never mutated).

**`bom_items`** *(new)* — per version, per material
`id, bom_version_id FK (cascade), material_id FK → test_materials (set null — reuse material master), consumption decimal(12,4), wastage_pct decimal(5,2) (default 0), unit (from material), color_dependent bool, size_dependent bool, preferred_supplier_id FK → suppliers (nullable), remarks`

### Phase 2 — Planning (MRP, Reservation, Requisition)

**`material_requirements`** *(new)* — the computed MRP result per order × material
`id, order_id FK (cascade), material_id FK, bom_version_id FK, gross_qty decimal(12,3), wastage_qty decimal(12,3), net_qty decimal(12,3), created_at`
Regenerated on demand by the MRP service (never hand-edited; kept so dashboards can aggregate without recomputing every query).

**`material_reservations`** *(new)*
`id, order_id FK (cascade), material_id FK, qty decimal(12,3), status (Active/Released/Cancelled), created_by, created_at`
*Derived:* `reserved_total(material) = SUM(Active)`. Available = Physical − reserved_total. Reservations release on material issue / order cancel.

**`purchase_requisitions`** *(new)*
`id, pr_no (unique, PR-00001), order_id FK (nullable), status (Draft/Pending_Approval/Approved/Converted/Rejected), required_date, remarks, created_by, created_at`

**`purchase_requisition_items`** *(new)*
`id, pr_id FK (cascade), material_id FK, qty decimal(12,3), reason, required_date`

### Phase 3 — Procurement & Warehouse

**`suppliers`** *(extend)* — additive columns
`+ supplier_code, address, payment_terms, shipping_terms, is_active bool, rating int (1–5)`

**`supplier_materials`** *(new)* — which supplier supplies what
`id, supplier_id FK (cascade), material_id FK (cascade), moq decimal(12,3), unit_price decimal(12,4), lead_time_days int, is_preferred bool, is_active bool, unique(supplier_id, material_id)`

**`supplier_price_history`** *(new)*
`id, supplier_id FK, material_id FK, unit_price decimal(12,4), price_date, remarks` — PO defaults from latest price.

**`purchase_orders`** *(new)*
`id, po_no (unique, PO-00025), supplier_id FK, pr_id FK (nullable, set null), order_date, delivery_date, status (Draft/Approved/Partially_Received/Received/Cancelled), currency, remarks, created_by, created_at`

**`purchase_order_items`** *(new)*
`id, po_id FK (cascade), material_id FK, qty decimal(12,3), unit_price decimal(12,4), received_qty decimal(12,3) default 0, cancelled_qty decimal(12,3) default 0`
*Derived:* remaining = qty − received − cancelled.

**`goods_receipts`** *(new, GRN)*
`id, grn_no (unique, GRN-00018), po_id FK, supplier_id FK, received_date, invoice_no, delivery_challan_no, warehouse_id FK, status (Pending_QC/QC_Passed/QC_Failed/Received), created_by, created_at`

**`goods_receipt_items`** *(new)*
`id, grn_id FK (cascade), po_item_id FK (nullable), material_id FK, received_qty, accepted_qty, rejected_qty, batch, lot, remarks`
- Accepted → stock in (+ledger, +test material marked `Pending` for QA). Rejected → return to supplier (recorded; not added to stock; QA can mark material `Failed` via the existing flow).

**`fabric_rolls`** *(new)* — roll-level fabric
`id, material_id FK, grn_item_id FK (nullable), roll_no, length decimal(10,2), width decimal(6,2), shade, batch, lot, gsm, remaining_length decimal(10,2), status (In_Stock/Partial/Finished), created_at`

**`warehouses`** *(new)* — seeded with "Main Material Warehouse"
`id, warehouse_code, warehouse_name, location` (keeps GRN/issue/FG location-aware; single-row for now)

**`stock_transactions`** *(new)* — THE audit ledger
`id, material_id FK, transaction_type (Opening/GRN/Issue/Adjustment_In/Adjustment_Out/Transfer_In/Transfer_Out/Return_To_Supplier), qty decimal(12,3) (signed), balance_after decimal(12,3), warehouse_id FK, reference_type, reference_id (polymorphic: GRN/Issue/Adjustment), remarks, created_by, created_at`
**Rule:** every stock movement writes a ledger row **and** updates `test_materials.stock_quantity` inside one DB transaction. Balance is always reconstructable from the ledger (`Opening + GRN + AdjIn − Issue − AdjOut − TransferOut + TransferIn − ReturnToSupplier = Physical`).

**`stock_adjustments`** *(new)*
`id, adjustment_no (unique), material_id FK, qty signed, reason, status (Pending/Approved/Rejected), created_by, approved_by FK nullable, created_at` — approved adjustments write ledger rows.

### Phase 4 — Production (Orders → Issue → Cutting → Sewing → Finishing)

**`production_orders`** *(new)* — one per sales order line (or per color)
`id, production_order_no (unique), sales_order_line_id FK, style_id FK, qty, status (Planned/Ready_For_Cutting/In_Cutting/In_Sewing/In_Finishing/Completed/Cancelled), line (e.g. "Line 3"), planned_start, planned_end, remarks, created_at`
*Derived:* WIP = qty − finishing output; delayed flag = status not Completed ∧ delivery_date passed.

**`material_issues`** *(new, MI)*
`id, issue_no (unique, MI-00015), production_order_id FK (nullable), warehouse_id FK, issued_to, status (Requested/Approved/Issued/Partial), issue_date, remarks, created_by, created_at`

**`material_issue_items`** *(new)*
`id, issue_id FK (cascade), material_id FK, requested_qty, issued_qty, unit, remarks`
- On `Issued`: ledger `Issue` row (−qty), `test_materials.stock_quantity` decremented, and the order's matching reservation released — all in one transaction.

**`cutting_plans`** *(new)*
`id, cutting_plan_no (unique), production_order_id FK, marker_no, lay_no, cut_qty, status (Planned/In_Progress/Completed), planned_date, remarks, created_at`

**`cutting_plan_items`** *(new)*
`id, cutting_plan_id FK (cascade), material_id FK, planned_consumption decimal(12,3), actual_consumption decimal(12,3), wastage_qty decimal(12,3) (derived: planned − actual), shortage_qty decimal(12,3), excess_qty decimal(12,3)`

**`cutting_bundles`** *(new)*
`id, cutting_plan_id FK (cascade), bundle_no, size, color, panel_count, qty`

**`production_output`** *(new)* — stage-wise movement & WIP
`id, production_order_id FK (cascade), stage (Sewing_Input/Sewing_Output/Finishing_Input/Finishing_Output), qty, rejection_qty, operator_id FK users nullable, recorded_at`

### Phase 5 — Quality, FG, Shipment, Dashboard

**`quality_checks`** *(new)* — production QC checkpoints (material QC stays in `material_test_logs`)
`id, check_no (unique), reference_type (Cutting/Sewing_Inline/End_Line/Finishing/Final), reference_id, production_order_id FK nullable, checked_by FK users, result (Passed/Failed/Rework), defect_code, defect_qty, remarks, checked_at`

**`finished_goods`** *(new)*
`id, fg_no (unique), production_order_id FK, sales_order_line_id FK, style_id FK, color, size, qty, carton_no, status (In_Stock/Packed/Shipped), warehouse_id FK, created_at`

**`shipments`** *(new)*
`id, shipment_no (unique, SH-00007), sales_order_id FK, buyer_id FK, destination, shipment_date, status (Planned/Partially_Shipped/Shipped/Completed), remarks, created_at`

**`shipment_items`** *(new)*
`id, shipment_id FK (cascade), sales_order_line_id FK, qty, cartons, size_breakdown JSON`
*Derived:* shipped qty vs order line qty → Pending / Partially / Completed.

**`document_sequences`** *(new, tiny)* — race-safe numbering
`id, doc_type (unique: PR/PO/GRN/MI/CP/FG/SH/ADJ/QC), last_no int` — incremented inside a transaction when issuing a document number.

### 4.1 Stock-cache migration note

When Phase 3 lands, run a one-time backfill: for each material, insert a `stock_transactions` `Opening` row with its current `stock_quantity` so the ledger starts consistent with the cache. Seeded demo materials already behave this way.

---

## 5. MRP Calculation Specification (the core)

Pure calculation service (`backend/server/services/mrp.js`) — no DB writes except persisting `material_requirements`. Testable in isolation (the existing e2e smoke harness is extended).

For a given order (all its lines → same BOM version, or per line):

```
For each material M in the order's BOM version:
  Q          = order qty for the line(s) using M
  C          = bom_item.consumption
  W          = bom_item.wastage_pct / 100

  gross      = Q × C
  wastage    = gross × W
  net        = gross + wastage                      # Net Requirement

  physical   = test_materials.stock_quantity        # ledger-maintained
  reserved   = SUM(Active material_reservations for M, all orders)
  available  = physical − reserved                  # never include reserved stock
  incoming   = SUM(open po_items: qty − received_qty − cancelled_qty) for M

  projected  = available + incoming
  shortage   = MAX(0, net − projected)

  # Suggested purchase
  prefSupp   = bom_item.preferred_supplier_id
               ?? supplier_materials.is_preferred for M
               ?? any active supplier of M (rating desc, lead_time asc)
  moq        = prefSupp.moq || 1
  suggestedQty = CEILING(shortage / moq) × moq      # round up to MOQ
  leadOk     = required_date − lead_time_days >= today   # lead-time feasibility flag
```

**Worked example (matches the request):**

```
Shell Fabric — Order 1,000 pcs, consumption 1.80 m/pc, wastage 5%
  gross = 1000 × 1.80            = 1,800 m
  net   = 1800 × 1.05            = 1,890 m
  physical = 1,200 | reserved(others) = 300 → available = 900
  incoming PO = 500  → projected = 1,400
  shortage = 1,890 − 1,400       = 490 m
  MOQ (ABC Textile) = 100 m → suggested PO qty = CEILING(490/100)×100 = 500 m
```

Dashboard rows per material: `Required | Stock | Reserved | Incoming | Shortage | Action (OK / Purchase n u)`.

---

## 6. Frontend Architecture Plan

Preserve the existing login + dashboard; introduce a shared app shell.

- `app/(app)/layout.jsx` — authenticated shell: sidebar nav (all modules), top bar with user + role + logout. Reuses existing header styling.
- Move the current material table into the shell as **`/materials`** (functionality unchanged — same page code, new route).
- `/dashboard` becomes the **management dashboard** (KPI cards per §3/§19) with a light version shipped at the end of each phase.
- New pages (one per module, same component patterns — client components, `lucide-react`, `api` util, toasts):
  - Phase 1: `/buyers`, `/styles` (+ BOM editor), `/orders` (multi-line booking), `/boms` (version list per style)
  - Phase 2: `/mrp` (order selector → requirement table + actions), `/requisitions` (create from MRP, approve)
  - Phase 3: `/purchase-orders` (convert PR, receiving progress), `/grn` (receive + QC), `/warehouse` (ledger, adjustments, fabric rolls), extended supplier form (MOQ/lead time/price)
  - Phase 4: `/production` (orders + stages + WIP), `/cutting` (plans, bundles), `/material-issues`
  - Phase 5: `/quality`, `/finished-goods`, `/shipments`, `/dashboard` (full KPIs)

---

## 7. Implementation Sequence (dependencies + phases)

**Dependency graph:** Buyers/Styles → Orders → BOM → MRP → PR → PO → GRN → Ledger → Issue → Production → FG → Shipment.

| Phase | Modules | Schema | Key routes | Pages | Depends on |
|---|---|---|---|---|---|
| **1 — Merchandising** | Buyers, Styles, Sales Orders, BOM + versions | 7 tables + amendments | `/api/buyers`, `/api/styles`, `/api/orders` (CRUD + multi-line), `/api/styles/:id/boms` (versions+items) | /buyers, /styles, /orders, /boms + app shell | existing materials (BOM references them) |
| **2 — Planning** | MRP, Reservation, Stock availability, PR | 4 tables | `/api/mrp/orders/:id`, `/api/mrp/orders/:id/reserve`, `/api/requisitions` (create/approve) | /mrp, /requisitions | Phase 1 (orders, BOM) + materials |
| **3 — Procurement & Warehouse** | Suppliers extended, PR→PO, GRN + QC, Ledger, Adjustments, Fabric rolls | 8 tables + `suppliers`/`test_materials` extensions + opening backfill | `/api/supplier-materials`, `/api/purchase-orders`, `/api/grn` (receive+accept/reject), `/api/stock` (ledger/adjustments), `/api/fabric-rolls` | /purchase-orders, /grn, /warehouse | Phase 2 (PRs); GRN needs PO |
| **4 — Production** | Production orders, Material Issue, Cutting, Sewing/Finishing output | 6 tables | `/api/production` (orders+output), `/api/material-issues`, `/api/cutting` (plans+bundles) | /production, /cutting, /material-issues | Phase 1 (orders), Phase 3 (ledger for issues) |
| **5 — Quality, FG, Shipment, Dashboard** | Quality checks, FG, Shipments, KPI dashboard | 4 tables | `/api/quality`, `/api/finished-goods`, `/api/shipments`, `/api/dashboard` (aggregates) | /quality, /finished-goods, /shipments, /dashboard | Phase 4 (output → FG) + Phase 1 (orders) |

Each module ships: Drizzle tables + relationships → migration (`drizzle-kit generate`) → Express routes (CRUD, validation, `authenticate`/`authorize`) → frontend page(s) → e2e smoke checks extended.

---

## 8. Decisions Needed Before Coding

- **D1 — Roles:** add `Production_Manager` + `Procurement` to the role enum (recommended), or keep the existing 4 and map duties (Merchandiser → PR/sales, Store_Manager → PO/GRN/issue, QA_Inspector → QC, Admin → approvals)?
- **D2 — Decimals:** change `test_materials.stock_quantity` from `int` to `decimal(12,3)` (recommended for fabric). Confirmed OK since the DB (`test-DB-Material`) is dedicated.
- **D3 — Order units:** MRP is calculated at **order level** (aggregating lines of the same style); per-line (color-level) calculation is supported via `order_line_id` if you want shade-aware fabric reservation later. Default: order level.
- **D4 — Scope of Phase 1:** start with Buyer + Style + Sales Order + BOM (7 tables) exactly as the request's Phase 1, before touching suppliers/warehouse.
- **D5 — Seed data:** extend `db/seed.js` with the worked example (Columbia, JK-1001, COL-2026-001, BOM v1) so every phase is demo-able from day one.

---

## 9. What Is NOT Done Yet (explicitly out of scope unless requested)

- Full capacity planning / line scheduling (SMV-based) — stored fields only.
- Payroll, HR, accounting/ledger (finance GL), CMT billing.
- Buyer EDI / B2B portals.
- Sample-management workflow (fit/PP/top sample tracking) — recommended as a post-Phase-5 extension.
- Export documentation (commercial invoice, packing list, L/C tracking) — shipment module stores the basics.
