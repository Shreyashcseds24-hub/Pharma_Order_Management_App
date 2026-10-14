# MediFlow AI — Pharma Order Management & Inventory Tracking

Frontend for an AI-based pharmaceutical order management and inventory tracking system,
built for distributors, wholesalers and medical retailers.

The UI is fully functional against a local sample dataset and is structured so the same
services can point at a Flask + MySQL REST API without changing any page code.

## Stack

React 19 (Vite 8) · JavaScript (JSX) · Tailwind CSS v4 · React Router 7 · Lucide React · Recharts · Axios

## Run it

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

Requires Node 20.19+ or 22.12+ (Vite 8). On Node 20.18 the app still runs, but Vite prints
an engine warning — upgrading Node is recommended.

## Demo accounts

The login page has a **development-only role switcher**. Pick a role and the form is
prefilled:

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Administrator | admin@mediflow.demo | admin123 | Everything, incl. Settings |
| Distributor | distributor@mediflow.demo | distributor123 | Catalog, inventory, approve/reject orders, invoices, reports |
| Retailer | retailer@mediflow.demo | retailer123 | Browse catalog, place orders, view AI insights |

These credentials exist only in the frontend mock layer. **Frontend role checks are a UI
affordance, not a security boundary** — authorization must be enforced by the Flask API.

## Connecting the Flask backend

`.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK_API=false
```

With `VITE_USE_MOCK_API=false`, every service function issues a real HTTP request through
the shared Axios instance (`src/services/api.js`), which attaches the bearer token and
normalises errors. Endpoints already referenced by the services:

| Method | Path | Service |
| --- | --- | --- |
| POST | `/auth/login` | authService |
| POST | `/auth/register` | authService |
| POST | `/auth/logout` | authService |
| GET | `/auth/profile` | authService |
| GET/POST | `/medicines` | medicineService |
| PUT/DELETE | `/medicines/:id` | medicineService |
| GET | `/inventory` | inventoryService |
| GET | `/inventory/summary` | inventoryService |
| GET | `/inventory/movements` | inventoryService |
| POST | `/inventory/batches/:id/adjust` | inventoryService |
| GET | `/orders` | orderService |
| POST | `/orders` | orderService |
| PATCH | `/orders/:id/status` | orderService |
| GET | `/retailers` | orderService |
| GET | `/invoices` | analyticsService |
| GET | `/invoices/:id` | analyticsService |
| POST | `/invoices/:id/payment` | analyticsService |
| GET | `/analytics/dashboard` | analyticsService |
| GET | `/analytics/forecast?horizon=7\|30` | analyticsService |
| GET | `/analytics/reports` | analyticsService |

No credentials, secrets or production URLs are committed. Tokens live in `localStorage`
for the demo only.

## Data layer

- `src/data/mockData.js` — the entire fictional sample dataset (medicines, batches,
  retailers, orders, invoices, sales series, activity feed).
- `src/data/mockStore.js` — an in-memory clone so create/update/adjust actions behave
  like real API writes for the duration of a session.
- `src/data/constants.js` — roles, statuses, dosage forms, categories, suppliers.

## About the AI features

The AI Insights page is explicitly labelled as demo output. Forecasts, confidence values
and replenishment quantities come from a simple moving-average heuristic computed in
`mockData.js`; they are **not** produced by a trained model. Replace
`GET /analytics/forecast` with a Python forecasting service when it is ready, and update
the disclaimer on that page.

## Structure

```
src/
  components/     layout (sidebar, topbar, app shell), ui (button, card, modal, drawer,
                  form, badge, table, toast, skeleton, states), charts, tables
  context/        AuthContext — session + derived permissions
  data/           constants, mockData, mockStore
  hooks/          useAsync, useDebounce, useDismiss (click-outside + focus trap)
  layout/         AuthLayout, navConfig
  pages/          Login, Register, Dashboard, Medicines, Inventory, Orders,
                  AIInsights, Invoices, Reports, Settings
  services/       api (axios), authService, medicineService, inventoryService,
                  orderService, analyticsService, reportService
  utils/          format, permissions
```

Pages are lazy-loaded so Recharts and page code split out of the initial bundle.