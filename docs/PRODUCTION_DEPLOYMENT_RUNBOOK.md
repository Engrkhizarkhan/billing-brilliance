# Fintap production deployment runbook

This runbook deploys application changes only. It does not modify the established StrongSwan, loopback, routing, Nginx TLS, firewall, or 1LINK VPN configuration.

## Required values and approvals

- Approved release commit/tag and maintenance window.
- Recent successful encrypted database backup plus tested restore owner.
- Production `.env` with `NODE_ENV=production`, `APP_ENVIRONMENT=production`, `DB_NAME=Fintap`, strong unique JWT/webhook secrets, `REQUIRE_HTTPS=true`, prefix `105172`, and 1LINK source IPs `10.95.8.92,10.95.8.94`.
- Do not print `.env`, PSK, database password, JWT secrets, API keys or certificate private keys.
- The leaf/full-chain certificate may be shared where required; never share `privkey.pem`.

## 1. Pre-deployment evidence

Run on a CI runner or clean checkout:

```bash
npm ci
npm run lint
npm run test
npm run build
npm --prefix server ci
npm --prefix server test
npm audit --omit=dev
npm --prefix server audit --omit=dev
```

Rehearse `npm --prefix server run migrate` on a restored production-like database first. Validate record counts, consumer uniqueness, payment/ledger reconciliation, and application smoke tests. Do not make `migrate:fresh` available in a production procedure.

## 2. Back up production

Resolve the configured database name without echoing credentials. The following assumes MySQL login is supplied securely by the operator or an existing protected option file:

```bash
install -d -m 700 /root/backups/fintap
mysqldump --single-transaction --routines --triggers --events Fintap | gzip > /root/backups/fintap/Fintap-predeploy-$(date +%Y%m%d-%H%M%S).sql.gz
test -s /root/backups/fintap/$(ls -1t /root/backups/fintap/Fintap-predeploy-*.sql.gz | head -n1 | xargs basename)
```

Copy the backup to the approved off-host encrypted backup location and record its checksum. Do not proceed if backup or restore ownership is uncertain.

## 3. Build and migrate

From `/var/www/billing-brilliance` after checking out the approved revision:

```bash
npm ci
npm run build
npm --prefix server ci
npm --prefix server run migrate
```

Migration `007_production_foundation.js` is additive, checksum-tracked, and required by production startup. Never edit it after it has been applied; create a new numbered migration.

## 4. Start API and worker

```bash
pm2 startOrReload server/ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

Expected processes:

- `Fintap-api-backend`
- `Fintap-outbox-worker`

The API binds to `127.0.0.1:3000`; Nginx remains the TLS/public/private-VPN listener on port 443.

## 5. Post-deployment checks

```bash
curl --fail --silent --show-error https://app.fintap.pk/api/health
curl --fail --silent --show-error https://app.fintap.pk/api/ready
pm2 logs Fintap-api-backend --lines 100 --nostream
pm2 logs Fintap-outbox-worker --lines 100 --nostream
```

Run a read-only inquiry against a disposable UAT consumer from the approved network. Payment testing requires an explicitly disposable UAT consumer and `E2E_ALLOW_PAYMENT=true`:

```bash
cd /var/www/billing-brilliance/server
E2E_BASE_URL=http://127.0.0.1:3000 E2E_CONSUMER_NUMBER='REPLACE_UAT_CONSUMER' node tests/e2e_1link_flow.js
```

Credentials remain sourced from the protected server environment; do not put them in shell history.

## 6. Database integrity checks

Run using a read-only operations account where possible:

```sql
SELECT version, checksum, applied_at FROM schema_migrations ORDER BY applied_at;

SELECT tenant_id, reference, COUNT(*) duplicates
FROM payments
WHERE reference IS NOT NULL
GROUP BY tenant_id, reference
HAVING COUNT(*) > 1;

SELECT tenant_id, idempotency_key, COUNT(*) duplicates
FROM payments
WHERE idempotency_key IS NOT NULL
GROUP BY tenant_id, idempotency_key
HAVING COUNT(*) > 1;

SELECT tenant_id, consumer_number, COUNT(*) duplicates
FROM (
  SELECT tenant_id, consumer_number FROM students WHERE deleted_at IS NULL
  UNION ALL SELECT tenant_id, consumer_number FROM applicants WHERE deleted_at IS NULL
  UNION ALL SELECT tenant_id, consumer_number FROM org_payment_records
) consumers
GROUP BY tenant_id, consumer_number
HAVING COUNT(*) > 1;

SELECT status, COUNT(*) FROM outbox_events GROUP BY status;
```

Any duplicate payment key or consumer namespace is a stop condition.

## 7. Application rollback

If the release fails before accepting new financial writes, return to the prior approved application revision, rebuild, and use `pm2 startOrReload`. Database migrations are forward-only; do not blindly reverse or drop columns. If financial writes occurred, incident/reconciliation ownership must decide recovery from the backup or a corrective migration.

Never use `git reset --hard`, delete the production database, or run `migrate:fresh` as rollback.

## 8. Sandbox deployment

Use `server/.env.sandbox.example` on a separate hostname/process/database/user. The sandbox database name must contain `sandbox`, `uat`, or `test`; otherwise startup fails. Do not route the sandbox host into the production 1LINK IPsec tunnel. Use independent API/JWT/webhook credentials and a separate retention/reset policy.
