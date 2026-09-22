# Fintap — billing and payment administration

React/TypeScript portals for platform administrators, schools, and organizations, backed by Express and MySQL. School invoices, student ledgers, organization payment requests, verified payment posting, signed webhook delivery, and tenant lifecycle controls share one backend.

## Current documentation

- [Architecture and operating rules](docs/CURRENT_SYSTEM.md)
- [Webhook contract](docs/WEBHOOKS.md)
- [Deployment and release gates](docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [CI](docs/CI_CD.md)
- [Hardening changes and verification](docs/PRODUCTION_HARDENING_2026-09-23.md)

Dated audits, requirements, VPN handovers, and `docs/workflow/` describe their point in time. They do not certify the current deployment. The static `website/` is a separate Payniva marketing site; the Fintap application is built from `src/`.

## Local development

Use Node 22 and MySQL 8.4 (the CI versions). Install both dependency sets:

```sh
npm ci
npm ci --prefix server
cp server/.env.example server/.env.local
```

Edit the local file: set a disposable database such as `fintap_local_dev`, local credentials, `NODE_ENV=development`, `APP_ENVIRONMENT=development`, `PORT=3000`, `CORS_ORIGIN=http://localhost:8080`, unique JWT secrets, and local administrator credentials. Never copy production credentials into a development database. `FINTAP_ENV_FILE` selects the runtime file explicitly and overrides inherited variables.

```sh
FINTAP_ENV_FILE="$(pwd)/server/.env.local" npm run migrate --prefix server
FINTAP_ENV_FILE="$(pwd)/server/.env.local" npm run dev --prefix server
# Separate terminals:
FINTAP_ENV_FILE="$(pwd)/server/.env.local" npm run worker:outbox --prefix server
npm run dev
```

Use an **absolute path** for `FINTAP_ENV_FILE` when a command changes directory (including `npm --prefix server`). Alternatively create the file as `server/.env` and omit the override. The API defaults to port 5000 if PORT is absent; the example config uses 3000. The frontend defaults to proxying port 3000; override with `DEV_API_TARGET=http://127.0.0.1:<port>`.

The bootstrap administrator comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. No default production login is provided. A testing tenant can configure users/students/plans, but financial charging requires a live tenant or the separate sandbox runtime. Do not bypass activation on a real deployment.

## Verification

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm test --prefix server -- --runInBand
```

Database regression checks require a dedicated migrated database and explicit target confirmation:

```sh
FINTAP_ENV_FILE=/absolute/path/to/test.env npm run migrate --prefix server
FINTAP_ENV_FILE=/absolute/path/to/test.env INTEGRATION_DATABASE_CONFIRM=fintap_test_hardening npm run test:hardening --prefix server
```

The test suite creates and removes UUID-scoped fixtures and installs a temporary database trigger to test rollback. Never run it against production. Destructive reset/seed/fresh commands additionally require `ALLOW_DISPOSABLE_DB_RESET` equal to the exact disposable database name; production runtimes and other names are rejected.

Browser checks use a separately started local API/frontend and disposable data:

```sh
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:8080 E2E_ADMIN_EMAIL=<test-email> E2E_ADMIN_PASSWORD=<test-password> E2E_ADMIN_PIN=<test-pin> npm run test:e2e -- e2e/dashboard-route-smoke.spec.ts
```

Some other end-to-end suites require a separate sandbox installation. Read each suite's prerequisites. Do not point browser tests at a live service.

## Production status

The code contains production hardening and regression checks. Launch still requires a restored-backup migration rehearsal, server/worker monitoring, real provider UAT and network approval, settlement reconciliation, and verification of production secrets and backups. No local test can establish those external facts.
