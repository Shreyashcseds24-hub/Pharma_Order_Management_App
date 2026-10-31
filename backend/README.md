# MediFlow AI — Flask + PostgreSQL backend

REST API for the MediFlow AI pharma order-management UI. It owns authentication,
role enforcement, the medicine catalog, batch inventory, the full order lifecycle,
invoices and every dashboard/report aggregate. The React frontend talks to it when
`VITE_USE_MOCK_API=false`.

- Python 3.11+ / Flask 3
- SQLAlchemy 2 + Flask-Migrate (Alembic)
- PostgreSQL 14+ (SQLite is supported for fast local tests)
- JWT bearer authentication with hashed passwords (Werkzeug PBKDF2)

Full endpoint reference: [`docs/API.md`](docs/API.md).

## Quick start

```bash
cd backend

python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env            # then edit DATABASE_URL + JWT_SECRET_KEY
```

Create the database once (PostgreSQL):

```bash
createdb mediflow
# or: psql -U postgres -c "CREATE DATABASE mediflow;"
```

Apply the schema and (optionally) load the demo dataset:

```bash
flask --app run.py db upgrade
flask --app run.py seed        # development/demo only; never automatic
```

Run the API:

```bash
python run.py                   # http://127.0.0.1:5000/api
```

Health checks:

- Liveness: `GET /api/health` or `GET /api/health/live`
- Database readiness: `GET /api/health/ready` (`503` when PostgreSQL is unreachable)

Create a production administrator without demo data:

```bash
flask --app run.py create-admin
```

> `python run.py` loads `backend/.env` before the Flask config is read. When using
> the `flask` CLI, export the same variables or rely on the loaded `.env` file.

### Demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@mediflow.demo` | `admin123` |
| Distributor | `distributor@mediflow.demo` | `distributor123` |
| Retailer | `retailer@mediflow.demo` | `retailer123` |

These accounts are created by the seed command only. Change the passwords (or
delete the accounts) before exposing a deployment.

## Configuration

All settings come from environment variables; see [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` / `FLASK_ENV` | `development` | Set either to `production` to enable strict startup validation. |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/mediflow` | SQLAlchemy URL. `postgres://` / `postgresql://` are rewritten to `postgresql+psycopg2://`. |
| `JWT_SECRET_KEY` | insecure dev value | HMAC key for access tokens. Production requires 32+ random characters. |
| `SECRET_KEY` | falls back to `JWT_SECRET_KEY` | Flask signing key. |
| `JWT_ACCESS_TOKEN_HOURS` | `12` | Access-token lifetime. |
| `FLASK_DEBUG` | `0` in production, `1` in development | Set to `0` in production; validation rejects debug mode there. |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | Bind address for `python run.py`. |
| `CORS_ALLOWED_ORIGINS` | local Vite origins (empty in production) | Comma-separated allowed browser origins. `CORS_ORIGINS` is accepted as an alias. |
| `REGISTRATION_ALLOWED_ROLES` | `retailer` in production | Roles a visitor can self-register. Privileged self-registration is rejected in production. |
| `LOG_LEVEL` / `LOG_FORMAT` | `INFO` / `text` (`json` in production) | Structured logging controls. |
| `RUN_MIGRATIONS` | `true` in Docker | Run Alembic before Gunicorn in the container entrypoint. |

Production startup fails fast when the JWT/session secrets are weak or
placeholders, `DATABASE_URL` is not PostgreSQL, debug is enabled, CORS contains
`*`, or admin/distributor self-registration is enabled. See
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the full guide.

Generate a real key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Never commit `.env`, `.pgdata/`, database dumps or real credentials.

## Tests

The suite runs on in-memory SQLite by default and does not touch the development
database:

```bash
pip install -r requirements-dev.txt
pytest
python -m pyflakes app tests run.py
```

To run the exact same suite against PostgreSQL (required for the concurrent
oversell test, which exercises row-level locking):

```bash
# Linux / macOS
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mediflow_test" pytest
# Windows PowerShell
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mediflow_test"; pytest
```

The PostgreSQL run drops and recreates every table in `mediflow_test`; never point
it at a database you care about.

## Roles and permissions

Permissions are checked by the API on every request; the frontend only hides
actions. They mirror the mock UI.

| Permission | Admin | Distributor | Retailer |
| --- | :-: | :-: | :-: |
| `catalog:write` — create/update/archive medicines | ✓ | ✓ | |
| `inventory:write` — adjust batch stock | ✓ | ✓ | |
| `orders:approve` — advance/cancel any order | ✓ | ✓ | |
| `orders:create` — place an order for own retailer | | | ✓ |
| `reports:view` — dashboard, reports, forecast | ✓ | ✓ | ✓ |
| Invoices & payments (`/api/invoices/*`) | ✓ | ✓ | |
| `settings:write` | ✓ | | |

Retailers are also scoped: they only see their own orders/invoices data on the
dashboard and cannot read another retailer's order (the API returns `404`, not a
leak). Only retailer accounts can create orders, and the retailer is derived from
the authenticated user rather than the request body.

## Order lifecycle

```
Pending -> Approved -> Processing -> Shipped -> Delivered
   |          |
   +----------+--> Cancelled
```

- `Pending`, `Approved`, `Processing`, `Shipped`, `Delivered` and `Cancelled` are the
  only valid statuses.
- Skipping a step (for example `Pending -> Shipped`) is rejected with `422`.
- Retailers may only cancel their **own** `Pending`/`Approved` orders; admins and
  distributors may advance or cancel any order.
- Creating an order prices every line from the catalog (client prices are ignored),
  allocates stock FEFO (earliest expiry first), preferring the requested warehouse
  and falling back to other warehouses, and writes an invoice in the same
  transaction.
- Available stock excludes expired batches. An oversell attempt returns `422` and
  rolls the whole transaction back. PostgreSQL row locks prevent two concurrent
  checkouts from consuming the same units.
- Cancelling a `Pending`/`Approved` order restores its allocated quantities, writes
  `Return` stock movements and marks its invoice `Cancelled`.
- Historical seed orders have no allocations, so cancelling them does not invent
  stock.

## Data model

Tables (all with `created_at`/`updated_at` timestamps where applicable):

`roles`, `users`, `retailers`, `categories`, `suppliers`, `medicines`, `batches`,
`inventory`, `stock_movements`, `orders`, `order_items`, `order_item_allocations`,
`order_events`, `invoices`, `activity_log`, `notifications`, `counters`,
`revoked_tokens`.

Key guarantees enforced in the schema:

- `inventory.quantity >= 0` (check constraint), plus API-side validation.
- Unique medicine/batch/order/invoice business IDs, unique user emails and unique
  invoice numbers.
- Foreign keys for medicine → category/supplier, batch → medicine/supplier,
  inventory → batch, order item → order/medicine, invoice → order/retailer.
- One invoice per order (`invoices.order_id` unique).
- Indexes on the columns used by lists, expiry lookups and report queries.

Medicine deletion is a **soft delete** (`is_active = false`) so historical orders
and invoices stay readable.

### Migrations

```bash
flask --app run.py db migrate -m "describe the change"
flask --app run.py db upgrade
```

Alembic files live in `migrations/`. Do not edit an applied migration; add a new
one. `flask --app run.py init-db` exists for throwaway SQLite databases only.

### Seeding

```bash
flask --app run.py seed           # inserts the demo dataset if it is missing
flask --app run.py seed --reset   # DESTRUCTIVE: drops all tables first
```

Seeding is an explicit development/demo action. It is never run by the Docker
entrypoint or application startup, and it refuses to run when users already
exist. Do not use `--reset` against real data.

The seed mirrors the frontend mock data: 40 medicines, batches, 8 retailers,
24 orders, 14 invoices, stock movements, activity, notifications and the three
demo users.

## Project layout

```
backend/
  app/
    __init__.py          # app factory, JWT callbacks, health probes, blueprint registration
    config.py            # env-driven config, production validation, PostgreSQL URL normalisation
    logging_config.py    # structured text/JSON logging and request ids
    extensions.py        # db, migrate, jwt, cors
    models.py            # SQLAlchemy schema and ID counters
    permissions.py       # role matrix and auth decorators
    serializers.py       # exact frontend response contracts
    utils.py             # validation, money/date helpers, audit writers
    seed.py              # demo dataset
    cli.py               # flask seed / init-db
    blueprints/
      auth.py            # login, register, logout, profile, password
      medicines.py       # catalog CRUD
      inventory.py       # rows, summary, movements, stock adjustment
      orders.py          # order create/list/status + retailers
      invoices.py        # invoice list/detail/payment
      analytics.py       # dashboard, reports, forecast
  migrations/            # Alembic environment and versions
  tests/                 # pytest suite (SQLite + PostgreSQL)
  docs/API.md            # endpoint reference
  Dockerfile             # production Gunicorn image
  docker-entrypoint.sh   # migrations then Gunicorn; never seeds
  run.py                 # development entry point
```

## Security notes

- Passwords are hashed with Werkzeug; plaintext passwords are never stored.
- JWTs are signed, expire, and can be revoked on logout via `revoked_tokens`.
- CORS is limited to the configured frontend origins.
- Production startup rejects weak/placeholder secrets, debug mode, non-PostgreSQL
  URLs, wildcard CORS and privileged self-registration.
- All totals, stock quantities and role checks are computed server-side; the API
  never trusts client-supplied prices, stock or roles.
- Error responses are uniform: `{"message": "...", "status": 422, "errors": {...}}`.
  Production 500 responses never include stack traces.
- Structured logs cover startup, API/DB errors, authentication, order lifecycle,
  inventory adjustments and invoices. Passwords, secrets and full tokens are
  never logged; request bodies are never logged.
- `/api/health` (`/live`) is a liveness probe; `/api/health/ready` verifies the
  database without exposing connection details.
