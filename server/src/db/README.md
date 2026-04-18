# Payniva — Database Scripts

All scripts live in `server/src/db/` and are run from the **`server/`** directory.

---

## Prerequisites

- MySQL 8+ running and accessible
- `server/.env` configured (see `.env.example`)
- Dependencies installed: `cd server && npm install`

---

## Files

| File | Purpose |
|------|---------|
| `db.js` | Shared connection factory — imported by the scripts below |
| `schema.sql` | Complete database schema (all tables, single file) |
| `migrate.js` | Creates the database and applies `schema.sql` |
| `seed.js` | Inserts demo tenants, users, students, postings, etc. |
| `reset.js` | Truncates all data; preserves `admin@example.com` |
| `SCHEMA.md` | Full table & column reference |
| `migrations/archive/` | Historical individual migration files (001–011) |

---

## Quick Start (fresh environment)

```bash
cd server

# 1. Apply schema
node src/db/migrate.js

# 2. Load demo data
node src/db/seed.js
```

---

## Commands

### `migrate.js` — Apply schema

```bash
# Apply schema.sql to the configured database (idempotent — safe to re-run)
node src/db/migrate.js

# Drop the database and recreate from scratch, then apply schema
node src/db/migrate.js --fresh
```

> All tables use `CREATE TABLE IF NOT EXISTS`, so re-running on an existing DB is safe.

---

### `seed.js` — Load demo data

```bash
# Insert demo data into the existing database
node src/db/seed.js

# Reset all data first, then re-seed (combines reset + seed in one command)
node src/db/seed.js --fresh
```

**What gets seeded:**

| Section | Count |
|---------|-------|
| Tenants | 5 (3 school, 1 org, 1 school) |
| Roles | 6 |
| Permissions | 64 (16 resources × 4 actions) |
| Users | 5 (admin, school admin, org, finance sub-user, banned) |
| Students | 50 (25 per school tenant) |
| Fee plans | 4 |
| Fee heads | 7 |
| Scholarships | 6 |
| Org postings | 4 |
| Services | 5 |
| Applicants | 15 (org tenant) |
| Invoices | 30 |
| Transactions | 20 |
| Audit logs | 10 |
| Bill bundles | 5 |

**Demo credentials** (password: `123456` for all):

| Email | Role |
|-------|------|
| `admin@example.com` | Platform admin |
| `school@example.com` | School admin (Beacon House) |
| `org@example.com` | Org manager (KPK Organization) |
| `finance@school.com` | Finance sub-user (Beacon House) |
| `jane@agency.com` | Banned user |

---

### `reset.js` — Clear all data

```bash
# Truncate all operational tables; keep admin@example.com
node src/db/reset.js
```

**What is truncated:** all transactional and reference tables (students, invoices, transactions, applicants, postings, fee plans, scholarships, etc.)

**What is preserved:**
- `admin@example.com` user record
- `bundle_pcids` (API key config — not a seeded table)

---

## Programmatic Usage (`db.js`)

`db.js` can be required in any Node.js script that needs a one-off database connection (e.g., data-fix scripts, CI jobs).

```js
const { createConnection, withConnection } = require('./db');

// Option A: manual lifecycle
const conn = await createConnection();
const [rows] = await conn.query('SELECT * FROM tenants');
await conn.end();

// Option B: auto-close helper
const rows = await withConnection(async (conn) => {
  const [result] = await conn.query('SELECT COUNT(*) AS n FROM students');
  return result[0].n;
});
console.log('Total students:', rows);
```

> `db.js` calls `dotenv.config()` automatically — no need to load `.env` yourself.

---

## Common Workflows

### First-time local setup
```bash
cd server
npm install
node src/db/migrate.js
node src/db/seed.js
npm run dev
```

### Reset and re-seed during development
```bash
node src/db/seed.js --fresh
```

### Wipe everything and start from a blank DB
```bash
node src/db/migrate.js --fresh
node src/db/seed.js
```

### Apply schema changes (add a new table or column)
1. Edit `schema.sql` to add the new `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE`.
2. Run `node src/db/migrate.js` — existing tables are unaffected; new tables are created.
3. Update `SCHEMA.md` to document the change.

---

## Environment Variables

Set these in `server/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=payniva

FINTECH_PREFIX=123456
```
