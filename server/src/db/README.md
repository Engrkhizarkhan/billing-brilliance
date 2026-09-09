# Fintap database scripts

Run these commands from `server/` against MySQL 8 or later.

## Normal migration

```bash
npm run migrate
```

The migrator applies the consolidated create-if-missing schema, then checksum-tracked numbered JavaScript migrations. In production it refuses to create a missing database and refuses `--fresh`.

Before a production migration, restore a recent production backup into an isolated staging database, rehearse the migration, and execute the integrity queries in `../../../docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`.

## Local disposable database

Copy `.env.example` to `.env`, keep `NODE_ENV=development`, set `REQUIRE_HTTPS=false`, and configure:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=Fintap_local
DB_USER=your_local_user
DB_PASSWORD=your_local_password
```

Only for a disposable local database:

```bash
npm run migrate:fresh
npm run seed
```

Never run `migrate:fresh`, `reset.js`, or destructive seed/reset options against production, UAT evidence, or any database containing real payment history.

## Files

| File | Purpose |
|---|---|
| `schema.sql` | Fresh-install schema |
| `migrate.js` | Environment-aware migrator and checksum ledger |
| `migrations/007_production_foundation.js` | Additive lifecycle/payment/security/outbox upgrade |
| `SCHEMA.md` | Table and compatibility reference |
| `seed.js` | Development-only sample data |
| `reset.js` | Destructive development-only reset helper |

Existing `.sql` files in `migrations/` are historical compatibility artifacts. New production changes must be implemented as a new numbered JavaScript migration with an `up` function; never edit an already-applied migration.
