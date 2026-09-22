# Production release runbook

Updated 23 September 2026. This release changes deployment layout: **do not copy the new forced-command script onto the old in-place checkout without provisioning the layout below first**. This procedure does not change VPN, network selectors, firewall, TLS or provider settings.

## Release gates

1. Pass frontend type checks, unit tests, lint and build; backend unit and MySQL regression suites; and disposable-environment browser journeys. CI pins Node 22 and MySQL 8.4.
2. Restore an encrypted production backup into an isolated staging database. Apply forward migrations, compare counts, run read-only reconciliation, and exercise billing/payment/reversal flows. Back up secrets too, especially API_KEY_ENCRYPTION_KEY. Historical accounting discrepancies require evidence-based reconciliation, not bulk balance replacement.
3. Rehearse a failed build, failed migration and failed readiness check using the new deployment layout. Confirm that the old release remains/rebecomes active and that its code is compatible with forward migrations. Database rollback is not automatic.
4. Verify real provider UAT over the approved connection: inquiry, exact payment, duplicate, invalid credentials, insufficient/mismatched amount, expired bill, and agreed correction/reversal procedures. Confirm contracted consumer lengths, authoritative selectors/IPs, TLS, allowlists, settlement files and reconciliation owner. Historical VPN documents are not current approval.
5. Confirm worker monitoring, outbox terminal-failure alerts, tested backup restoration, disk/log retention, operational support and rollback ownership. Keep one API instance while SSE uses a process-local event bus.
6. Review and publish actual commercial/privacy policies and approve marketing branding/claims before publishing the separate static marketing site. Contact now opens an email draft; it is not a lead-capture service and mailbox ownership must be verified.

## One-time release layout provisioning

Prepare these paths during a controlled maintenance window, retaining a backup of the current checkout:

| Path | Purpose |
|---|---|
| `/var/lib/fintap/repository.git` | Bare Git repository with the approved origin; deploy account can fetch |
| `/var/lib/fintap/releases/<revision>.<unique>` | Immutable application releases, including built dist and production server dependencies |
| `/var/www/billing-brilliance` | Symlink to the active release; existing Nginx dist root resolves through it |
| `/etc/fintap/production.env` | Protected shared runtime configuration, readable only by service/deploy owner |
| `/etc/fintap/migration.env` | Optional privileged migration configuration; API and worker use the restricted production account |
| `/etc/fintap/sandbox.env` | Optional separate sandbox configuration; when present, the same release migrates, reloads and checks both sandbox processes |
| `/var/lib/fintap/deployed-revision` | Last fully verified successful revision |

Create the initial release from the currently deployed code, preserve its built assets/dependencies and REVISION, and point the application path to that release. Keep the original checkout backup outside the served path. Confirm Nginx follows the symlink and PM2 processes run from that release's server directory. Do not delete the previous release or backups during the cutover.

Set `NODE_ENV=production`, `APP_ENVIRONMENT=production`, existing production DB credentials, strong distinct JWT/refresh/webhook secrets, `REQUIRE_HTTPS=true`, approved 1LINK credentials/IP allowlist, ADMIN credentials/PIN, a stable 32-byte base64 API_KEY_ENCRYPTION_KEY, CORS origin and explicit PORT. Set the separately deployed SANDBOX_BASE_URL/PURGE_SECRET as required by onboarding. Keep file permissions at 0600 and preserve the established encryption key. Never reuse the development fallback key. FINTAP_ENV_FILE is passed explicitly to migrations and both PM2 processes.

Frontend public configuration must be build-time available (e.g. reviewed `.env.production` build configuration or environment variables on the deployment host). Do not place API credentials, DB passwords or server secrets in VITE-prefixed variables.

Install `deploy/fintap-github-deploy` as the restricted forced command for the deployment SSH key. Keep existing host-key verification. The command accepts only `deploy <40-character-tested-SHA>`; it never evaluates arbitrary SSH commands. Ensure `/usr/bin/node`, npm, pm2, git, curl and flock are the approved executables for the service account.

## Normal release

CI sends its exact GITHUB_SHA. The script verifies the commit is on fetched main, stages it into a new release directory, installs dependencies and builds there, then applies forward migrations. Before activation, the live application tree is untouched.

An atomic symlink replacement activates the staged release. PM2 reloads API and worker with the shared environment file. The release is successful only when `/api/ready` returns the target revision and fresh production worker heartbeat, and both PM2 processes report online from the staged directory. Only then is deployed-revision replaced and PM2 saved.

Any build/install/migration error stops before activation. Any post-activation error attempts to restore the previous symlink and processes. The prior build is retained, so rollback does not require another install/build. Inspect rollback logs and readiness manually after a failure. Forward database migrations remain applied; incompatible/destructive migrations require a separate reviewed rollout strategy.

The script deliberately does not skip solely because Git HEAD equals the target. Failed deployments can be retried safely into a fresh release directory. Deployment locking prevents concurrent activation.

## Verification and monitoring

`/api/health` checks process liveness. `/api/ready` checks MySQL, production worker heartbeat (90-second freshness), and returns revision. API startup checks required migration versions. Protect infrastructure endpoints appropriately at the network edge; do not confuse HTTP liveness with financial correctness.

Monitor worker heartbeat, failed/exhausted/skipped outbox records, provider response failures, authorization failures, reconciliation differences, disk capacity, database backups, and PM2 restart counts. Worker status online alone is insufficient. Keep a durable off-host copy of deployment logs and encrypted backups.

Run `npm run reconcile --prefix server` against a read-only database account where practical. The report does not mutate data; investigate every difference before launch. Do not run seed, reset, or migrate:fresh on production.

Deployment evidence and remaining provider acceptance requirements are recorded separately in `DEPLOYMENT_VERIFICATION_2026-09-23.md`. Automated application tests do not constitute 1LINK certification.

## Missing historical invoice charges

`server/src/operations/restoreMissingInvoiceCharges.js` defaults to a dry-run plan. It only accepts accounts with exactly one existing invoice, no original debit, zero cached balance, and payment credits that exactly match canonical allocations. Ambiguous accounts stop the entire operation. Apply requires `INVOICE_CHARGE_PLAN_HASH` from the reviewed plan and `INVOICE_CHARGE_DATABASE_CONFIRM` matching the selected database. The transaction rechecks evidence under tenant locks, appends missing charges and audit records, and derives cached balances; existing invoices and payments are preserved. Back up and rehearse on a restored copy first. Never use this as a general balance reset.
