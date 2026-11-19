# MediFlow AI — Pharma Order Management & Inventory Tracking

Full-stack pharmaceutical order management and inventory tracking for distributors,
wholesalers and medical retailers. The React UI is backed by a Flask + PostgreSQL
API with JWT authentication, role-based authorization, FEFO stock allocation and
transactional invoicing. A local mock mode remains available for offline UI work.

## Overview

MediFlow AI gives a distributor team one place to manage the medicine catalog,
batch inventory, retailer orders, invoices, payments and operational analytics.
The production frontend is a static Vite build served by nginx; nginx proxies
`/api/*` to Gunicorn over a private Docker network, and PostgreSQL stores all
business data on a persistent volume.

The UI uses a custom neumorphic "Soft UI" design system. The application does not
depend on a third-party component library for its visual identity.

## Features

- **Authentication and roles** — signed, expiring JWTs; logout revocation;
  hashed passwords; admin, distributor and retailer roles enforced by the API.
- **Medicine catalog** — create, edit, archive (soft delete) and search medicines
  with category, supplier, pricing and prescription metadata.
- **Batch inventory** — batch/expiry tracking, warehouse stock, stock movements,
  manual adjustments and a database-level non-negative quantity constraint.
- **FEFO order fulfilment** — earliest-expiry-first allocation, warehouse
  preference, PostgreSQL row locks, and all-or-nothing checkout transactions.
- **Order lifecycle** — `Pending → Approved → Processing → Shipped → Delivered`,
  with cancellation from `Pending`/`Approved` and stock restoration.
- **Invoices and payments** — server-calculated totals and tax, one invoice per
  order, payment status, and admin/distributor-only invoice access.
- **Analytics and forecasting** — dashboard aggregates, reports and a documented
  rule-based forecasting heuristic (not a trained ML model).
- **AI operations assistant** — optional LLM-backed chat on the AI Insights page
  that answers inventory, order, sales and expiry questions through read-only,
  role-scoped database tools. Medical questions are declined with a referral to a
  healthcare professional. Disabled in demo mode; no answers are fabricated.
- **Retailer scoping** — retailers only see their own orders and related data.
- **Two frontend data modes** — live Flask API or the original in-browser mock
  data layer.
- **Production operations** — structured logs, liveness/readiness probes, Docker
  images, migrations on startup, CI and deployment documentation.

## Architecture

```
                         Docker network (private)
 ┌──────────────┐      ┌──────────────────────┐      ┌──────────────┐
 │   Browser    │─────▶│ nginx (frontend)     │─────▶│ Gunicorn +   │
 │              │      │ static SPA + /api/*  │      │ Flask API    │
 └──────────────┘      └──────────────────────┘      └──────┬───────┘
                                                            │
                                                     ┌──────▼───────┐
                                                     │ PostgreSQL   │
                                                     │ named volume │
                                                     └──────────────┘
```

- The browser only needs one origin; nginx forwards `/api/*` to the backend.
- PostgreSQL has no published port in the default Compose file.
- Local development runs Vite on `:5173` and Flask on `:5000` directly.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS v4 |
| UI/data | Lucide React, Recharts, Axios, custom neumorphic components |
| Backend | Python 3.12, Flask 3, SQLAlchemy 2, Flask-Migrate/Alembic |
| Auth | Flask-JWT-Extended, Werkzeug password hashing, API-enforced RBAC |
| Database | PostgreSQL 14+ (16 recommended); SQLite for fast tests |
| Runtime | Gunicorn, nginx, Docker Compose |
| Quality | pytest, pyflakes, oxlint, Vite production build, GitHub Actions |

## Screenshots

The repository intentionally does not ship large binary screenshots. Add captures
under `docs/screenshots/` and reference them here:

| View | Suggested file |
| --- | --- |
| Dashboard | `docs/screenshots/dashboard.png` |
| Medicine catalog | `docs/screenshots/medicines.png` |
| Batch inventory | `docs/screenshots/inventory.png` |
| Order detail and lifecycle | `docs/screenshots/order-detail.png` |
| Invoice and payment | `docs/screenshots/invoices.png` |

Suggested capture flow: run the seeded app in live mode, use the admin demo
account, and capture at a 1440×900 viewport for consistent documentation.

## Local development setup

### Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 8)
- Python 3.11+ (3.12 recommended)
- PostgreSQL 14+ for live backend development

### Frontend

```bash
npm install
cp .env.example .env
# For mock-only UI work, keep VITE_USE_MOCK_API=true.
npm run dev                 # http://localhost:5173
```

For live local development, set:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK_API=false
```

Other commands:

```bash
npm run build               # production build to dist/
npm run preview             # serve the production build
npm run lint                # oxlint
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL + JWT_SECRET_KEY
createdb mediflow
flask --app run.py db upgrade
flask --app run.py seed         # optional demo data, development only
python run.py                   # http://127.0.0.1:5000/api
```

Health checks:

```bash
curl http://127.0.0.1:5000/api/health          # liveness
curl http://127.0.0.1:5000/api/health/ready    # database readiness
```

See [`backend/README.md`](backend/README.md) for backend-specific details and
[`backend/docs/API.md`](backend/docs/API.md) for the endpoint reference.

## Docker setup

The Compose stack builds the frontend and backend, starts PostgreSQL with a named
volume, waits for database/backend health, and proxies the UI to the API.

```bash
cp .env.example .env
# Edit .env and set at least:
#   POSTGRES_PASSWORD=<long random password>
#   JWT_SECRET_KEY=<32+ random characters>
#   SECRET_KEY=<different 32+ random characters>
docker compose up --build
```

Open:

- UI: <http://localhost:8080>
- API health: <http://127.0.0.1:5000/api/health/ready>

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose exec backend flask --app run.py db current
docker compose exec backend flask --app run.py create-admin
docker compose down             # keeps the postgres_data volume
docker compose down -v          # DESTRUCTIVE: deletes the database volume
```

Notes:

- Compose **forces** `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=/api` at
  frontend build time. Production cannot accidentally ship mock mode.
- The backend entrypoint runs `flask db upgrade` before Gunicorn. It never seeds
  demo data.
- PostgreSQL is not published to the host. The backend is published on
  `127.0.0.1:5000` for local operations only.
- Empty `POSTGRES_PASSWORD`/`JWT_SECRET_KEY` values make Compose fail fast with a
  clear message; secrets are never baked into images.

## Environment variables

Only `VITE_*` values are exposed to the browser bundle. Never place backend
secrets in a `VITE_*` variable.

### Frontend (build time)

| Variable | Development | Production | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | `/api` behind nginx | API base URL, no trailing slash. |
| `VITE_USE_MOCK_API` | `true` or `false` | `false` | `true` uses local mock data; `false` calls the API. |

### Backend

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ENVIRONMENT` / `FLASK_ENV` | Production | `development` | `production` enables strict startup validation. |
| `DATABASE_URL` | Yes | local PostgreSQL | SQLAlchemy URL; `postgres://` is normalised to psycopg2. |
| `JWT_SECRET_KEY` | Yes | insecure dev value | HMAC key for JWTs; production requires 32+ random characters. |
| `SECRET_KEY` | Recommended | JWT key | Flask signing key. |
| `JWT_ACCESS_TOKEN_HOURS` | No | `12` | Access-token lifetime. |
| `CORS_ALLOWED_ORIGINS` | Production | local Vite origins | Comma-separated allowed browser origins. |
| `CORS_ORIGINS` | No | alias | Backwards-compatible alias for `CORS_ALLOWED_ORIGINS`. |
| `REGISTRATION_ALLOWED_ROLES` | Production | `retailer` in production | Roles a visitor can self-register. |
| `HOST` / `PORT` | No | `127.0.0.1` / `5000` | Local `run.py` bind settings. |
| `LOG_LEVEL` | No | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`. |
| `LOG_FORMAT` | No | `text` dev / `json` prod | Structured JSON logs in production. |
| `RUN_MIGRATIONS` | No | `true` in Docker | Run Alembic before Gunicorn. |
| `POSTGRES_DB` | Compose | `mediflow` | Database name. |
| `POSTGRES_USER` | Compose | `mediflow` | Database user. |
| `POSTGRES_PASSWORD` | Compose | — | Database password; required. |
| `LLM_PROVIDER` | No | `openai` | `openai`, `openai-compatible` or `ollama`. |
| `LLM_MODEL` | No | `gpt-4o-mini` | Provider model name. |
| `LLM_API_KEY` | OpenAI providers | — | Backend-only credential; never sent to the browser. |
| `LLM_BASE_URL` | No | provider default | OpenAI-compatible endpoint or Ollama URL. |
| `LLM_TIMEOUT` / `LLM_MAX_TOKENS` | No | `30` / `800` | Provider request timeout and completion limit. |
| `AI_MAX_MESSAGE_LENGTH` | No | `2000` | Maximum chat question length. |
| `AI_RATE_LIMIT_REQUESTS` / `AI_RATE_LIMIT_WINDOW_SECONDS` | No | `20` / `300` | Per-user chat rate limit. |

Production startup rejects weak/placeholder JWT secrets, debug mode, non-PostgreSQL
database URLs, wildcard CORS and privileged self-registration. The complete
reference is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Database migrations

Alembic revisions live in `backend/migrations/versions/`.

```bash
cd backend
flask --app run.py db current
flask --app run.py db upgrade
flask --app run.py db heads
```

- Startup applies forward-only migrations; existing data is preserved.
- Migration failure stops the backend with a clear non-zero exit. Inspect the
  logs rather than deleting the database volume.
- Never edit an applied migration; create a new revision.
- `init-db` is only for throwaway SQLite experiments. Production uses Alembic.
- The demo seed is manual and explicitly opt-in. It is never run at startup.

### Initial database setup and administrator

```bash
# On an empty database:
flask --app run.py db upgrade
flask --app run.py create-admin
```

`create-admin` prompts for email, name and a confirmed password, hashes it with
Werkzeug and never echoes the password. For Docker:

```bash
docker compose exec backend flask --app run.py create-admin
```

## Demo credentials (development only)

The seed dataset creates these accounts. They are for local development and
demos only; delete or change them before exposing any environment.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@mediflow.demo` | `admin123` |
| Distributor | `distributor@mediflow.demo` | `distributor123` |
| Retailer | `retailer@mediflow.demo` | `retailer123` |

Production Compose sets `REGISTRATION_ALLOWED_ROLES=retailer` and does not seed
these users. Use `create-admin` instead.

## Testing

### Frontend

```bash
npm ci
npm run lint
npm run build
```

### Backend

```bash
cd backend
pip install -r requirements-dev.txt
python -m pyflakes app tests run.py
python -m pytest -ra                                        # SQLite, fast
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mediflow_test" \
  python -m pytest -ra                                      # PostgreSQL + concurrency
```

The PostgreSQL run drops and recreates tables in `mediflow_test`; never point it
at a database with data you care about. The concurrency test exercises
PostgreSQL row locking and is skipped only on non-PostgreSQL runs.

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and
pushes to `main`:

- frontend `npm ci`, `npm run lint`, `npm run build`
- backend dependency install, pyflakes, SQLite tests and PostgreSQL tests
  (including the concurrency test)
- no automatic deployment

## Production deployment

See the complete guide in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). It covers:

- Docker Compose on a single host with persistent PostgreSQL storage
- split static frontend + Flask API + managed PostgreSQL deployments
- TLS/reverse-proxy placement and production API URLs/CORS
- migration strategy, health probes and rolling updates
- administrator provisioning, backups/restores and troubleshooting

Minimum production checklist:

```dotenv
ENVIRONMENT=production
FLASK_DEBUG=0
DATABASE_URL=postgresql://user:password@db:5432/mediflow
JWT_SECRET_KEY=<32+ random characters>
SECRET_KEY=<different 32+ random characters>
CORS_ALLOWED_ORIGINS=https://app.example.com
REGISTRATION_ALLOWED_ROLES=retailer
LOG_FORMAT=json
```

Build the frontend with `VITE_USE_MOCK_API=false` and the production API URL.

## Backup and restore

Docker Compose:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U mediflow -d mediflow -Fc \
  > backups/mediflow-$(date +%F-%H%M).dump

# Restore (take a fresh backup first):
docker compose stop backend frontend
docker compose exec -T db pg_restore -U mediflow -d mediflow \
  --clean --if-exists < backups/mediflow-YYYY-MM-DD-HHMM.dump
docker compose start backend frontend
```

Non-Docker:

```bash
pg_dump "$DATABASE_URL" -Fc -f backups/mediflow.dump
pg_restore --clean --if-exists -d "$RESTORE_DATABASE_URL" backups/mediflow.dump
```

Store backups encrypted and off-host, and restore-test them routinely. Never run
`docker compose down -v` or `flask seed --reset` against production data.

## Security notes

- Passwords are hashed with Werkzeug PBKDF2; plaintext is never stored or logged.
- JWTs are signed, expire after the configured lifetime and are revoked on
  logout through the `revoked_tokens` table.
- Authorization is enforced on every backend request; the frontend only hides
  actions it knows the user cannot perform. Retailers are scoped to their own
  orders.
- Production refuses to start with dev/weak secrets, debug mode, non-PostgreSQL
  URLs, wildcard CORS or public admin/distributor registration.
- Order prices and totals are recomputed from the catalog; client-supplied
  prices are ignored. Invoice totals/tax are server-calculated.
- FEFO allocation and PostgreSQL row locks prevent expired stock sales and
  concurrent overselling. `inventory.quantity >= 0` is also a DB constraint.
- SQL access goes through SQLAlchemy's parameterised ORM/expressions.
- Production errors return generic JSON without stack traces. Structured logs
  include IDs, statuses, durations and error types, never passwords, JWT secrets
  or full tokens.
- LLM credentials stay on the backend. The assistant can only call whitelisted
  read-only tools, is retailer-scoped, rate-limited per user and declines medical
  advice; prompt text and tool results are treated as untrusted input.
- The database is private on the Docker network and not published by default.
- Bearer tokens are stored in `localStorage` by the existing frontend. Protect
  against XSS with a CSP/WAF at the reverse proxy and keep dependencies updated.

## Two frontend data modes

| Mode | `.env` | Behaviour |
| --- | --- | --- |
| Mock | `VITE_USE_MOCK_API=true` | Services resolve from `src/data/mockData.js` / `mockStore.js`; no network calls. |
| Live | `VITE_USE_MOCK_API=false` | Services call the Flask API through the shared Axios instance. |

In live mode the app hides demo banners, sends the JWT, clears stale sessions on
`401`, and redirects to `/login` when the token expires or is revoked. The rest
of the UI is unchanged. Production/Docker builds force live mode.

## API endpoints used by the frontend

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Sign in and receive a JWT |
| POST | `/auth/register` | Self-register an allowed role |
| POST | `/auth/logout` | Revoke the presented token |
| GET/PATCH | `/auth/profile` | Read/update the current profile |
| POST | `/auth/password` | Change password |
| GET/POST | `/medicines` | List/create medicines |
| GET/PUT/DELETE | `/medicines/:id` | Read/update/archive a medicine |
| GET | `/inventory` | Batch inventory rows |
| GET | `/inventory/summary` | Inventory KPIs |
| GET | `/inventory/movements` | Recent stock movements |
| POST | `/inventory/batches/:id/adjust` | Adjust batch stock |
| GET/POST | `/orders` | List/create orders |
| GET | `/orders/:id` | Order detail |
| PATCH | `/orders/:id/status` | Advance/cancel an order |
| GET | `/retailers` | Retailer directory (scoped) |
| GET | `/invoices` | Invoice list (admin/distributor) |
| GET | `/invoices/:id` | Invoice detail |
| POST | `/invoices/:id/payment` | Record payment |
| GET | `/analytics/dashboard` | Dashboard aggregates |
| GET | `/analytics/forecast?horizon=7\|30` | Rule-based forecast |
| GET | `/analytics/reports` | Report data |
| POST | `/ai/chat` | Ask the read-only operations assistant |
| GET | `/ai/status` | Whether the LLM provider is configured (no secrets) |
| GET | `/ai/conversations` | Current user's recent conversations |
| GET | `/ai/conversations/:id` | One owned conversation transcript |
| GET | `/health`, `/health/live` | Liveness |
| GET | `/health/ready` | Database readiness |

All API routes are prefixed with `/api`.

## About the AI features

### Rule-based analytics

The forecast cards on the AI Insights page are explicitly labelled as rule-based
output. Forecasts, confidence values and replenishment quantities come from a
moving-average heuristic; they are **not** produced by a trained model. The same
heuristic is implemented server-side at `GET /analytics/forecast` so live and mock
modes agree.

### Live operations assistant

The same page includes **Ask MediFlow AI**. When an LLM provider is configured, the
assistant answers operational questions using a fixed set of read-only backend
tools:

| Tool | Data |
| --- | --- |
| `get_inventory_summary` | Aggregate stock, value and expiry KPIs |
| `get_low_stock_medicines` | Items at or below their reorder level |
| `get_expiring_medicines` | Batches expiring in a chosen window |
| `get_medicine_details` | One catalog medicine and its batches |
| `get_order_summary` | Recent orders, optionally by status |
| `get_sales_summary` | Revenue, units and order counts |
| `get_top_selling_medicines` | Best sellers by units |
| `get_pending_orders` | Orders awaiting approval |
| `get_inventory_recommendations` | Replenishment suggestions |

Safety properties:

- Tools are read-only. The model cannot create orders, adjust stock, record
  payments or change prices.
- Every tool call runs with the authenticated user's identity, so retailer
  scoping is enforced in SQL. Conversations are private to their owner.
- Tool arguments are validated against a whitelist; unknown tools and extra
  fields are rejected.
- Prompts treat user text and tool results as untrusted data. Prompt-injection
  attempts cannot add tools or bypass authorization.
- Medical questions (diagnosis, dosage, treatment, side effects, interactions)
  are declined before the provider is called, with a referral to a qualified
  healthcare professional.
- Per-user rate limiting uses recent persisted messages, so no Redis is required.
- Provider errors map to safe `502`/`503`/`504` responses. API keys and provider
  response bodies are never returned to the browser.
- In demo mode the panel is disabled and clearly says the backend is required. No
  answers are fabricated.

Configure it with the `LLM_*` variables in [`backend/.env.example`](backend/.env.example).
For a local model, run Ollama and set `LLM_PROVIDER=ollama`, `LLM_MODEL=llama3.1:8b`
and `LLM_BASE_URL=http://127.0.0.1:11434`. Backend tests inject a fake provider, so
`pytest` never contacts a paid API.

## Project structure

```
src/
  components/     layout, UI primitives, charts, tables
  context/        AuthContext — session, expiry handling, permissions
  data/           constants, mockData, mockStore
  hooks/          useAsync, useDebounce, useDismiss
  layout/         AuthLayout, navConfig
  pages/          Login, Register, Dashboard, Medicines, Inventory, Orders,
                  AIInsights, Invoices, Reports, Settings
  services/       api (axios), authService, medicineService, inventoryService,
                  orderService, analyticsService, reportService, aiService
  utils/          format, permissions
backend/
  app/            app factory, config, logging, models, blueprints, permissions, seed
    services/     analytics_data, ai_tools, ai_assistant, llm providers
    blueprints/ai.py  authenticated assistant endpoints
  migrations/     Alembic schema migrations (includes ai_conversations/ai_messages)
  tests/          pytest suite (SQLite + PostgreSQL concurrency test, mocked LLM)
  docs/API.md     endpoint reference
  Dockerfile      production backend image
docs/
  DEPLOYMENT.md   production deployment, migrations, backup/restore
Dockerfile.frontend, nginx.conf.template, docker-compose.yml
.github/workflows/ci.yml
```

Never commit `.env`, `backend/.env`, `backend/.venv/`, `backend/.pgdata/`,
database dumps, screenshots containing real data, or real credentials.
