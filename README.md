# MediFlow AI — Pharma Order Management & Inventory Tracking

Full-stack pharmaceutical order management and inventory tracking for distributors,
wholesalers and medical retailers. The React UI is backed by a real Flask +
PostgreSQL API in [`backend/`](backend/), with a local mock mode kept for offline
UI development.

## Stack

**Frontend:** React 19 (Vite 8) · JavaScript (JSX) · Tailwind CSS v4 · React Router 7 ·
Lucide React · Recharts · Axios

**Backend:** Flask 3 · SQLAlchemy 2 · Flask-Migrate (Alembic) · Flask-JWT-Extended ·
PostgreSQL 14+ · pytest

## Run the frontend

```bash
npm install
cp .env.example .env     # already present if you cloned this folder
npm run dev              # http://localhost:5173
```

Other commands:

```bash
npm run build            # production build to dist/
npm run preview          # serve the production build
npm run lint             # oxlint
```

Requires Node 20.19+ or 22.12+ (Vite 8). On Node 20.18 the app still runs, but Vite
prints an engine warning — upgrading Node is recommended.

## Run the backend

The API lives in a separate `backend/` directory and needs PostgreSQL.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL + JWT_SECRET_KEY
createdb mediflow
flask --app run.py db upgrade
flask --app run.py seed
python run.py                   # http://127.0.0.1:5000/api
```

See [`backend/README.md`](backend/README.md) for configuration, migrations, tests,
the schema and security notes. The full endpoint reference is
[`backend/docs/API.md`](backend/docs/API.md).

Run the backend test suite:

```bash
cd backend
pip install -r requirements-dev.txt
pytest                                                   # SQLite, fast
TEST_DATABASE_URL=postgresql://.../mediflow_test pytest  # PostgreSQL + locking test
```

## Two data modes

| Mode | `.env` | Behaviour |
| --- | --- | --- |
| Mock (default) | `VITE_USE_MOCK_API=true` | Every service resolves from `src/data/mockData.js` / `mockStore.js`; no network calls. |
| Live | `VITE_USE_MOCK_API=false` | Every service calls the Flask API through the shared Axios instance. |

```bash
# .env for live integration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK_API=false
```

In live mode the app hides demo banners/sidebar notices, sends the JWT on every
request, and redirects to `/login` if the token expires or is revoked. The UI,
components, navigation, forms, tables and modals are otherwise unchanged.

## Demo accounts

The login page keeps a development-only role switcher that prefills these seed
accounts. The same credentials work in mock mode and against a seeded backend:

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Administrator | admin@mediflow.demo | admin123 | Everything, incl. Settings and invoices |
| Distributor | distributor@mediflow.demo | distributor123 | Catalog, inventory, approve/reject orders, invoices, reports |
| Retailer | retailer@mediflow.demo | retailer123 | Browse catalog, place/cancel own orders, view AI insights |

These accounts are demo data. Authorisation is enforced by the API, not by the
browser: the frontend only hides actions it knows the user cannot perform.

## Connecting the frontend to the API

With `VITE_USE_MOCK_API=false`, service functions issue real HTTP requests through
`src/services/api.js`, which attaches the bearer token and normalises errors.
Endpoints used by the services:

| Method | Path | Service |
| --- | --- | --- |
| POST | `/auth/login` | authService |
| POST | `/auth/register` | authService |
| POST | `/auth/logout` | authService |
| GET/PATCH | `/auth/profile` | authService |
| POST | `/auth/password` | authService |
| GET/POST | `/medicines` | medicineService |
| GET/PUT/DELETE | `/medicines/:id` | medicineService |
| GET | `/inventory` | inventoryService |
| GET | `/inventory/summary` | inventoryService |
| GET | `/inventory/movements` | inventoryService |
| POST | `/inventory/batches/:id/adjust` | inventoryService |
| GET/POST | `/orders` | orderService |
| GET | `/orders/:id` | orderService |
| PATCH | `/orders/:id/status` | orderService |
| GET | `/retailers` | orderService |
| GET | `/invoices` | analyticsService |
| GET | `/invoices/:id` | analyticsService |
| POST | `/invoices/:id/payment` | analyticsService |
| GET | `/analytics/dashboard` | analyticsService |
| GET | `/analytics/forecast?horizon=7\|30` | analyticsService |
| GET | `/analytics/reports` | analyticsService |

Invoice endpoints are restricted to admins/distributors; retailers only see their
own orders and dashboard/report data. No credentials, secrets or production URLs
are committed. Tokens live in `localStorage` for the session.

### Backend guarantees

- Passwords are hashed; login returns a signed, expiring JWT that can be revoked.
- Roles/permissions are re-checked on every request.
- Medicines, batches, inventory movements, orders, invoices and reports are read
  from PostgreSQL — never from browser state.
- Order prices/totals are recomputed server-side. FEFO allocation prevents expired
  stock from being sold, and transactional row locks prevent overselling under
  concurrency.
- `inventory.quantity >= 0` is enforced by both the API and a database check
  constraint.
- Medicine deletion is a soft delete so historical orders and invoices remain
  intact.

## Data layer (mock mode)

- `src/data/mockData.js` — the fictional sample dataset used by the UI.
- `src/data/mockStore.js` — an in-memory clone so create/update/adjust actions behave
  like real API writes for the duration of a session.
- `src/data/constants.js` — roles, statuses, dosage forms, categories, suppliers.

The backend seed mirrors this dataset (40 medicines, batches, 8 retailers,
24 orders, 14 invoices, movements, activity, notifications, 3 demo users) with
relative dates.

## About the AI features

The AI Insights page is explicitly labelled as rule-based output. Forecasts,
confidence values and replenishment quantities come from a moving-average
heuristic; they are **not** produced by a trained model. The same heuristic is
implemented server-side at `GET /analytics/forecast` so live and mock modes agree.
Replace that endpoint with a real forecasting service when one is ready and update
the disclaimer on the page.

## Structure

```
src/
  components/     layout (sidebar, topbar, app shell), ui (button, card, modal, drawer,
                  form, badge, table, toast, skeleton, states), charts, tables
  context/        AuthContext — session, expiry handling, derived permissions
  data/           constants, mockData, mockStore
  hooks/          useAsync, useDebounce, useDismiss (click-outside + focus trap)
  layout/         AuthLayout, navConfig
  pages/          Login, Register, Dashboard, Medicines, Inventory, Orders,
                  AIInsights, Invoices, Reports, Settings
  services/       api (axios), authService, medicineService, inventoryService,
                  orderService, analyticsService, reportService
  utils/          format, permissions

backend/
  app/            app factory, config, models, blueprints, permissions, seed
  migrations/     Alembic schema migrations
  tests/          pytest suite (SQLite + PostgreSQL concurrency test)
  docs/API.md     endpoint reference
```

Pages are lazy-loaded so Recharts and page code split out of the initial bundle.
Never commit `.env`, `backend/.venv/`, `backend/.pgdata/`, database dumps or real
credentials.
