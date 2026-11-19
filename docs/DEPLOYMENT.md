# Deployment Guide

This guide covers deploying the MediFlow AI pharma order-management application
with a persistent PostgreSQL database. It describes both the included Docker
Compose stack and a split production deployment (static frontend + Flask API +
managed PostgreSQL).

Do not put real secrets in this file, in Git, or in image build arguments.

## Architecture

```
Internet / browser
        |
        v
  TLS reverse proxy or load balancer
        |
        +--> Static frontend (nginx / CDN)
        |        |
        |        +-- /api/* reverse proxy ------------+
        |                                            |
        +--------------------------------------------+
                                                     v
                                          Gunicorn + Flask API
                                                     |
                                                     v
                                          PostgreSQL (persistent volume
                                          or managed database)
```

- The frontend is a static Vite build. It must run in **live API mode**
  (`VITE_USE_MOCK_API=false`).
- The included nginx container proxies `/api/*` to the backend over the Docker
  network. The browser therefore uses a same-origin `/api` URL.
- PostgreSQL is **not published** by `docker-compose.yml`. Only the backend
  container can reach it.
- Migrations run forward-only on backend startup. Demo data is never seeded
  automatically.

## Option A — Docker Compose (single host)

### 1. Prerequisites

- Docker Engine 24+ with the Compose plugin
- At least 2 GB RAM available to Docker
- A hostname and TLS certificate for production (for example via Caddy, Traefik
  or a cloud load balancer)

### 2. Create the environment file

```bash
cp .env.example .env
```

Set at least these values in `.env`:

```dotenv
POSTGRES_DB=mediflow
POSTGRES_USER=mediflow
POSTGRES_PASSWORD=<long-random-password>
JWT_SECRET_KEY=<at-least-32-random-characters>
SECRET_KEY=<different-at-least-32-random-characters>
CORS_ALLOWED_ORIGINS=https://your-frontend.example.com
REGISTRATION_ALLOWED_ROLES=retailer
```

Optional AI assistant (leave `LLM_API_KEY` empty to keep chat disabled; the API
still starts and returns a safe `503` from `POST /api/ai/chat`):

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=<provider-key>
# LLM_BASE_URL=https://api.openai.com/v1
# Local Ollama: LLM_PROVIDER=ollama, LLM_MODEL=llama3.1:8b,
#               LLM_BASE_URL=http://host.docker.internal:11434
```

Never place `LLM_API_KEY` in a `VITE_*` variable: those values are compiled into
the browser bundle.

Generate random values locally:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Use a URL-safe password (letters, digits, `-`, `_`) because it is embedded in
the `DATABASE_URL`. If you must use other characters, percent-encode them.

`docker compose` fails fast with a clear message when `POSTGRES_PASSWORD` or
`JWT_SECRET_KEY` is empty. This is intentional.

### 3. Build and start

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

Expected startup sequence:

1. PostgreSQL becomes healthy (`pg_isready`).
2. The backend entrypoint runs `flask --app run.py db upgrade`.
3. Gunicorn starts and `/api/health/ready` returns `200`.
4. nginx starts after the backend is healthy.

The UI is served at `http://localhost:8080` by default. The API is published on
`127.0.0.1:5000` for local operations only; change `BACKEND_PORT` or remove that
port mapping if you do not need direct access.

### 4. Create the first administrator

Never rely on demo users in production. Create a real admin interactively:

```bash
docker compose exec backend flask --app run.py create-admin
```

The command validates the email, requires at least 8 password characters, hashes
the password and does not echo it.

Optionally create retailer accounts through the registration page when
`REGISTRATION_ALLOWED_ROLES=retailer`.

### 5. Put TLS in front

Terminate HTTPS at a reverse proxy/load balancer and forward traffic to the
frontend container port. Example Caddy block:

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Set `CORS_ALLOWED_ORIGINS` to the public HTTPS origin only if the frontend and API
are served from different origins. Same-origin deployments through the included
nginx proxy do not need CORS entries for the browser UI.

### 6. Persistent storage

The named volume `postgres_data` stores the database. It survives
`docker compose down` and container recreation. Do **not** run
`docker compose down -v` unless you intend to delete all data.

`docker compose up --build` is safe for upgrades: the existing volume is reused
and migrations are applied in place.

### 7. Backups and restore

Create a compressed logical backup:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U mediflow -d mediflow -Fc > backups/mediflow-$(date +%F-%H%M).dump
```

Verify it can be read:

```bash
pg_restore --list backups/mediflow-YYYY-MM-DD-HHMM.dump | head
```

Restore into the same database (this replaces objects; take a fresh backup first):

```bash
docker compose stop backend frontend
docker compose exec -T db pg_restore -U mediflow -d mediflow --clean --if-exists < backups/mediflow-YYYY-MM-DD-HHMM.dump
docker compose start backend frontend
```

For a restore into a new database (recommended validation):

```bash
docker compose exec db createdb -U mediflow mediflow_restore_test
docker compose exec -T db pg_restore -U mediflow -d mediflow_restore_test < backups/mediflow-YYYY-MM-DD-HHMM.dump
```

Never point test commands at a production database you cannot recreate. Store
backups encrypted and off-host, and test restores regularly.

## Option B — Split production deployment

Use this when the frontend is on a CDN/static host and the API/database are
managed separately.

### Frontend

1. Build with live mode and the public API URL:

   ```bash
   VITE_USE_MOCK_API=false \
   VITE_API_BASE_URL=https://api.example.com/api \
   npm ci
   VITE_USE_MOCK_API=false VITE_API_BASE_URL=https://api.example.com/api npm run build
   ```

   Vite inlines `VITE_*` values at build time. Rebuild for each environment;
   never put backend secrets in `VITE_*` variables.

2. Upload `dist/` to your static host/CDN.
3. Configure SPA fallback so unknown routes serve `index.html`.
4. Prefer same-origin hosting: serve the frontend at `https://app.example.com`
   and reverse-proxy `/api/*` to Flask. Then set
   `VITE_API_BASE_URL=/api`.

### Backend

1. Use a Python 3.12 image/runtime and install `backend/requirements.txt`.
2. Provide environment variables through your platform's secret manager:

   ```dotenv
   ENVIRONMENT=production
   DATABASE_URL=postgresql://user:password@db-host:5432/mediflow
   JWT_SECRET_KEY=<32+ random characters>
   SECRET_KEY=<different 32+ random characters>
   CORS_ALLOWED_ORIGINS=https://app.example.com
   REGISTRATION_ALLOWED_ROLES=retailer
   LOG_LEVEL=INFO
   LOG_FORMAT=json
   ```

3. Apply migrations before starting new application instances:

   ```bash
   flask --app run.py db upgrade
   ```

   The provided Docker entrypoint does this automatically. In a multi-replica
   deployment, run migrations once as a release job, or keep
   `RUN_MIGRATIONS=true` only on a single migration-capable instance.

4. Start Gunicorn (the Docker image uses these defaults):

   ```bash
   gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 4 --timeout 120 run:app
   ```

5. Health probes:
   - Liveness: `GET /api/health` or `/api/health/live`
   - Readiness (checks DB): `GET /api/health/ready`
   - Do not use readiness as a liveness probe; a database outage should remove
     the instance from rotation, not restart it.

6. Create an administrator:

   ```bash
   flask --app run.py create-admin
   ```

### PostgreSQL

- Use PostgreSQL 14+ (16 recommended).
- Enable automated backups and point-in-time recovery where available.
- Keep the database private; only the backend network/subnet should connect.
- Connection pool pre-ping is enabled (`pool_pre_ping=True`), which recovers
  from stale connections after a database restart.

## Database migrations

```bash
# check current revision
flask --app run.py db current

# apply all pending migrations (forward-only)
flask --app run.py db upgrade

# inspect the head revision
flask --app run.py db heads
```

Rules:

- Migrations are applied in a transaction where PostgreSQL supports it.
- **Never edit an already-applied migration.** Add a new revision instead.
- Migration failures stop backend startup with a clear `FATAL: database
  migrations failed` message and a non-zero exit code. Inspect
  `docker compose logs backend`.
- Do not run `flask --app run.py seed --reset` against a database with real data.
  The seed command is a development/demo tool and is never invoked by startup.
- `flask --app run.py init-db` (`db.create_all()`) is only for throwaway local
  SQLite experiments. Production must use Alembic.

If a migration fails halfway, restore the latest backup or fix the schema
forward. Do not delete the PostgreSQL volume as a first response.

## Configuration reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` / `FLASK_ENV` | Production | Set to `production` to enable strict validation. |
| `DATABASE_URL` | Yes | PostgreSQL URL. Production must not use the local default. |
| `JWT_SECRET_KEY` | Yes | HMAC key for access tokens; 32+ random characters. |
| `SECRET_KEY` | Recommended | Flask signing key; falls back to `JWT_SECRET_KEY`. |
| `JWT_ACCESS_TOKEN_HOURS` | No | Token lifetime, default `12`. |
| `CORS_ALLOWED_ORIGINS` | Production | Comma-separated browser origins. `*` is rejected. |
| `CORS_ORIGINS` | No | Backwards-compatible alias for `CORS_ALLOWED_ORIGINS`. |
| `REGISTRATION_ALLOWED_ROLES` | Production | Use `retailer`. Admin/distributor self-registration is rejected. |
| `PORT` / `HOST` | No | Local `run.py` bind settings; Gunicorn controls the container port. |
| `LOG_LEVEL` / `LOG_FORMAT` | No | `INFO`/`WARNING`/`ERROR`; `json` in production. |
| `RUN_MIGRATIONS` | No | Docker entrypoint default `true`; set `false` for release-job migrations. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Compose | Database bootstrap credentials. |
| `LLM_PROVIDER` / `LLM_MODEL` | No | Assistant provider and model. The API starts without them. |
| `LLM_API_KEY` / `LLM_BASE_URL` | Hosted providers | Backend-only credential/endpoint; never a `VITE_*` value. |
| `LLM_TIMEOUT` / `LLM_MAX_TOKENS` | No | Provider request timeout and completion limit, default `30`/`800`. |
| `AI_RATE_LIMIT_REQUESTS` / `AI_RATE_LIMIT_WINDOW_SECONDS` | No | Per-user assistant limit, default 20 requests per 300 seconds. |
| `VITE_API_BASE_URL` | Frontend build | API URL, for example `/api` behind the bundled proxy. |
| `VITE_USE_MOCK_API` | Frontend build | Must be `false` for production. |

## Security checklist

- [ ] `JWT_SECRET_KEY` and `SECRET_KEY` are unique, random and stored in a secret manager.
- [ ] `FLASK_DEBUG=0`; production startup rejects debug mode.
- [ ] PostgreSQL has no public port/firewall rule and uses a strong password.
- [ ] `REGISTRATION_ALLOWED_ROLES=retailer`; admins are created explicitly.
- [ ] `CORS_ALLOWED_ORIGINS` lists only real HTTPS origins and never `*`.
- [ ] LLM credentials live in a secret manager and never in `VITE_*` variables.
- [ ] If the assistant is not required, `LLM_API_KEY` is left empty (chat returns `503`).
- [ ] TLS terminates in front of the app; HTTP redirects to HTTPS.
- [ ] Backups are automated, encrypted off-host and restore-tested.
- [ ] Demo seed data is not present in production.
- [ ] Logs are shipped centrally; they contain IDs/statuses but no passwords,
      JWT secrets or full tokens.
- [ ] The frontend is rebuilt when `VITE_API_BASE_URL` changes.
- [ ] A CSP/WAF is considered because bearer tokens are stored in
      `localStorage` by the existing frontend; XSS protection is critical.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Compose exits asking for `POSTGRES_PASSWORD` / `JWT_SECRET_KEY` | Fill both values in `.env`; empty values are rejected by design. |
| Backend restarts with `Invalid production configuration` | Read the listed validation errors; fix the environment values. |
| Backend exits with `database migrations failed` | Inspect DB availability, credentials and the Alembic error in logs. Do not delete the volume. |
| Readiness returns `503` | PostgreSQL is unreachable or migrations/schema are unavailable. Check `docker compose logs db`. |
| Frontend calls the wrong API | Rebuild with the correct `VITE_API_BASE_URL`; Vite values are baked at build time. |
| CORS error in the browser | If split-hosted, set `CORS_ALLOWED_ORIGINS` to the exact scheme+host+port. |
| 401 after a server restart | JWTs remain valid (stateless) unless explicitly revoked; check the token expiry and `revoked_tokens`. |

## Demo data policy

`flask --app run.py seed` is the only way demo data is created, and it refuses to
run when users already exist. `--reset` additionally drops every table and must
never be used on production data. The Docker entrypoint never seeds.
