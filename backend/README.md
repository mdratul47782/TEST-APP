# 🏭 Test Material Warehouse — Management System

A complete, production-ready **Test Material Warehouse** management system for garments
factories (tailored to outdoor-apparel standards like **HKD Outdoor Innovations Ltd.**).
Track every fabric, trim, accessory, webbing, elastic and zipper — from the receiving bay
to QA approval — with Cloudinary-hosted quality certificates and a full audit trail.

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│   Next.js 15 (App Router)  │  HTTP  │   Express.js 5 API (:5000)   │
│   Tailwind CSS v4          │ ─────► │   Simple JWT auth (bcrypt)   │
│   localhost:3000           │        │   Cloudinary (multer)        │
│   utils/api.js (Bearer)    │        │   Drizzle ORM queries        │
└────────────────────────────┘        └──────────────┬───────────────┘
                                                     │ mysql2 pool
                                        ┌────────────▼──────────────┐
                                        │  MySQL 8 / phpMyAdmin     │
                                        │  pern-auth_template-db    │
                                        └───────────────────────────┘
```

---

## 🧱 Tech Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router), React 19, Tailwind CSS v4, lucide-react  |
| Backend    | Express.js 5, JWT (`jsonwebtoken`), bcrypt (`bcryptjs`)           |
| Database   | MySQL 8 + **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`)          |
| Storage    | Cloudinary (`multer-storage-cloudinary`) — certificates/reports   |
| Auth       | Stateless JWT Bearer tokens — **no sessions, no expiry constraints** |

---

## 📁 Project Structure

```
test-material-warehouse/
├── package.json              # Root scripts (run both apps with one command)
├── server/                   # Express.js API
│   ├── app.js                # Server entry, middleware, routes, error handling
│   ├── drizzle.config.js     # Drizzle Kit configuration
│   ├── .env                  # Local credentials (git-ignored)
│   ├── .env.example
│   ├── config/
│   │   ├── db.js             # mysql2 pool + Drizzle client
│   │   └── cloudinary.js     # Cloudinary SDK + multer upload engine
│   ├── db/
│   │   ├── schema.js         # Drizzle schema (users, suppliers, test_materials, material_test_logs)
│   │   └── seed.js           # Demo data (idempotent)
│   ├── middleware/
│   │   └── auth.js           # authenticate() + authorize(...roles)
│   └── routes/
│       ├── authRoutes.js     # POST /api/auth/register · /login
│       ├── materialRoutes.js # GET/POST /api/materials · PUT /:id/status
│       └── supplierRoutes.js # GET /api/suppliers
└── frontend/                 # Next.js app
    ├── next.config.mjs / postcss.config.mjs / jsconfig.json
    ├── .env.local            # NEXT_PUBLIC_API_URL
    ├── utils/
    │   └── api.js            # Fetch wrapper: injects JWT Bearer, handles 401
    └── app/
        ├── layout.jsx        # Root layout + metadata
        ├── globals.css       # Tailwind v4 entry + design tokens
        ├── page.jsx          # Login / Register
        └── dashboard/
            ├── page.jsx              # Dashboard: stats, filters, data table, badges
            ├── add-material-modal.jsx      # Add inventory + Cloudinary upload
            ├── update-status-modal.jsx     # QA status update + audit log
            ├── status-badge.jsx            # Pending=Yellow · Passed=Green · Failed=Red
            └── toast.jsx                  # Toast notifications
```

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js **18+** (tested on Node 24)
- MySQL 8 running locally (phpMyAdmin / XAMPP default)
- A Cloudinary account (credentials below are pre-filled in `server/.env`)

### 2. Create the database

In phpMyAdmin (or MySQL CLI) create an empty database:

```sql
CREATE DATABASE IF NOT EXISTS `pern-auth_template-db`;
```

### 3. Install dependencies

```bash
npm install            # root (concurrently)
npm --prefix server install
npm --prefix frontend install
```

### 4. Configure environment

`server/.env` is already filled with the target configuration. Copy for reference:

```bash
cp server/.env.example server/.env   # only if server/.env is missing
```

| Variable                    | Value                                                         |
| --------------------------- | ------------------------------------------------------------- |
| `PORT`                      | `5000`                                                        |
| `DATABASE_URL`              | `mysql://root:root1234@localhost:3306/pern-auth_template-db`  |
| `CLOUDINARY_CLOUD_NAME`     | `df8fxkmdo`                                                   |
| `CLOUDINARY_API_KEY`        | `197245291764796`                                             |
| `CLOUDINARY_API_SECRET`     | (in `server/.env`)                                            |
| `JWT_SECRET`                | any long random string                                        |
| `JWT_EXPIRES_IN`            | `30d` (generous — stateless JWT, no session store)            |

### 5. Create the schema (two options)

**Fast path — push schema directly:**

```bash
npm run db:push
```

**Versioned path — generate + apply migrations:**

```bash
npm run db:generate   # writes SQL to server/drizzle/
npm run db:migrate
```

### 6. Seed demo data (optional)

```bash
npm run db:seed
```

Creates demo users, 5 suppliers and 11 sample materials.

| Role          | Email                  | Password   |
| ------------- | ---------------------- | ---------- |
| Admin         | `admin@factory.com`    | `Admin@123`|
| Store Manager | `store@factory.com`    | `Admin@123`|
| QA Inspector  | `qa@factory.com`       | `Admin@123`|
| Merchandiser  | `merch@factory.com`    | `Admin@123`|

### 7. Run the app

```bash
npm run dev            # starts API (:5000) + frontend (:3000) together
```

Or separately: `npm run dev:server` / `npm run dev:frontend`.

- 🌐 Frontend: **http://localhost:3000**
- 🔌 API: **http://localhost:5000/api** (health check: `/api/health`)

---

## 🔌 REST API Reference

All endpoints except `/api/auth/*` require `Authorization: Bearer <token>`.

| Method | Endpoint                    | Body / File                                             | Access                                   |
| ------ | --------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| POST   | `/api/auth/register`        | `{ name, email, password, role? }` (role only honored with an Admin token) | Public (defaults to `Store_Manager`) |
| POST   | `/api/auth/login`           | `{ email, password }`                                   | Public                                   |
| GET    | `/api/materials`            | —                                                       | Any authenticated user                   |
| POST   | `/api/materials`            | `multipart/form-data`: `material_code`, `material_name`, `category`, `supplier_id?`, `stock_quantity?`, `unit?`, `rack_location?`, `test_status?`, `document?` (file) | Admin, Store_Manager |
| PUT    | `/api/materials/:id/status` | `{ testStatus, remarks? }`                              | Admin, QA_Inspector                      |
| GET    | `/api/suppliers`            | —                                                       | Any authenticated user                   |

### Behaviors worth knowing

- **`GET /api/materials`** returns materials **joined with supplier names** plus the
  **latest test log** per material (`latestTest` with tester name & remarks).
- **`POST /api/materials`** streams the uploaded certificate straight to Cloudinary
  (`multer-storage-cloudinary`); the returned URL is stored in `test_materials.document_url`.
  Duplicate `material_code` → `409`.
- **`PUT /api/materials/:id/status`** updates the material row **and** inserts an audit row
  into `material_test_logs` (`tested_by`, `test_result`, `remarks`) **inside a single
  transaction** — either both succeed or neither does.
- **Registration & roles:** public registration always creates a `Store_Manager` (safe default).
  A `role` in the body is only applied when the request carries a valid **Admin** token —
  this prevents privilege self-escalation. Admin accounts are created via `npm run db:seed`
  or an Admin-authenticated API call.
- 401s from the frontend wrapper auto-clear local auth and redirect to the login screen.

---

## 🗄️ Database Schema (Drizzle)

| Table                 | Key columns                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| `users`               | `name`, `email` (unique), `password` (bcrypt hash), `role`, `created_at`            |
| `suppliers`           | `supplier_name`, `contact_person`, `phone`, `email`, `created_at`                   |
| `test_materials`      | `material_code` (unique), `material_name`, `category`, `supplier_id` (FK), `stock_quantity`, `unit`, `rack_location`, `test_status`, `document_url`, `created_at` |
| `material_test_logs`  | `material_id` (FK → cascade), `tested_by` (FK → users), `test_result`, `remarks`, `tested_at` |

Category enum: `Fabric · Trim · Accessory · Webbing · Elastic · Zipper`
Test status enum: `Pending · Passed · Failed` (Yellow / Green / Red in the UI)
Role enum: `Admin · Store_Manager · QA_Inspector · Merchandiser`

---

## 🔐 Role Permissions Matrix

| Capability               | Admin | Store_Manager | QA_Inspector | Merchandiser |
| ------------------------ | :---: | :-----------: | :----------: | :----------: |
| View inventory           |  ✅   |      ✅       |      ✅      |      ✅      |
| Add material / upload    |  ✅   |      ✅       |      ❌      |      ❌      |
| Update test status       |  ✅   |      ❌       |      ✅      |      ❌      |

---

## 🧰 Common Commands

| Command                  | What it does                                        |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Start API + frontend together                       |
| `npm run db:generate`    | Generate migration SQL from the schema              |
| `npm run db:migrate`     | Apply migrations                                    |
| `npm run db:push`        | Push schema directly (dev fast path)                |
| `npm run db:seed`        | Insert demo users / suppliers / materials           |
| `npm run e2e:smoke`      | Full-stack smoke test on a scratch DB (auto-cleanup) |
| `npm run build`          | Production build of the Next.js frontend            |

---

## 🧪 Troubleshooting

- **`ECONNREFUSED` on :3306** — MySQL isn't running; start it (XAMPP / service) and confirm the
  database exists.
- **`Unknown database 'pern-auth_template-db'`** — create it (see step 2) or `db:push` first.
- **Cloudinary upload 400** — check `CLOUDINARY_*` values in `server/.env` and that the file is
  one of the allowed formats (jpg, png, webp, pdf, doc/x, xls/x, csv) under 10 MB.
- **Frontend can't reach API** — confirm `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches
  the API origin and that the server started on port 5000.
- **Ports already in use** — stop the other process, or change `PORT` / add `-p` to Next dev.

---

## 🗺️ Roadmap Ideas

- Material stock in/out transactions with movement history
- Supplier CRUD + purchase-order integration
- Reorder-request workflow with notifications
- Role-management screen for admins
- Export dashboard to CSV/Excel
