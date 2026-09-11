# Fintap implementation and production-readiness audit

Date: 10 September 2026  
Scope: administrator, school, organization, API, sandbox, database, and release controls  
Result: local release candidate verified; production deployment and external certification gates remain

## Executive outcome

The requested application changes are implemented in the local repository and verified against disposable XAMPP databases. The financial workflow now records evidence instead of directly changing a paid flag; testing tenants cannot create production receivables; privileged API-key and offboarding operations require the administrator PIN; the organization integration page documents only client-facing APIs; realtime dashboards use a pushed event stream; and the sandbox is an isolated runtime and database whose data/key are destroyed during activation.

This audit does not claim that the live server has been changed or that 1LINK has certified the release. No production networking, StrongSwan, loopback IP, Nginx, certificate, firewall, PM2 process, or production database was modified during this work.

## Implemented decisions

### Financial posting

- The platform administrator's **Verify Payment** page is the only dashboard workflow that can record independently verified funds.
- Inquiry returns a human-readable card and the corresponding 1BILL response without changing data.
- Recording funds calls the canonical transaction service. It atomically creates the payment, allocation, transaction, ledger entry, receipt/outbox evidence, notification, and audit log.
- School and organization dashboards are read-only for payment completion. Their manual record/reverse dialogs were removed, and the server routes are administrator-only.
- A simple `status = paid` toggle was deliberately rejected because it would make cash, ledger, reports, and audit evidence disagree.

### Biller suspension, offboarding, and activation

- **Suspend** disables payment/invoice mutations and makes the tenant's consumers unavailable to gateway lookup while preserving identifiers and history.
- **Unsuspend** restores the same identifiers and records. Consumer numbers are never nulled or regenerated.
- **Offboard** is PIN-gated, requires the exact biller name and a reason, revokes the API key, suspends users, and soft-deletes the tenant. Financial history is retained.
- **Activate/live** is not a generic enable switch. It confirms profile, credentials, source-IP configuration, UAT, and support ownership; purges the isolated sandbox; revokes its test key; and only then allows production invoices/payment requests.
- The complete operating process is in [BILLER_ACTIVATION_AND_ORG_ONBOARDING.md](./BILLER_ACTIVATION_AND_ORG_ONBOARDING.md).

### Testing lifecycle

- New tenants begin in `testing`.
- Testing tenants may populate students/applicants and configure their portal.
- Production invoice generation, additional charges, payment-request creation, and payment posting return `TENANT_NOT_LIVE` until activation.
- School and organization dashboards display a persistent testing banner and the same server error is surfaced if a restricted action is attempted.
- Suspension and lifecycle are separate: suspension answers whether the account is usable; lifecycle answers whether it is certified for production collection.

### API keys and destructive administration

- Tenant API keys authenticate by SHA-256 hash and retain a non-secret display prefix.
- A recoverable copy is stored as an AES-256-GCM envelope using `API_KEY_ENCRYPTION_KEY`; ordinary profile/list endpoints never return it.
- Reveal, rotation, sandbox provisioning, activation, and offboarding require the six-digit `ADMIN_ACTION_PIN`; sensitive routes have an additional rate limit and failed attempts are audited without logging the PIN. The protected `server/.env` value is authoritative over stale inherited process values and takes effect after an API restart.
- Rotation requires typed confirmation and immediately invalidates the prior key.
- Legacy hash-only keys cannot be revealed; the administrator is told to rotate them.
- The organization key identifier is sourced from `api_key_prefix`, fixing the previous unavailable label.

### Organization portal and API contract

- `customer_name` is mandatory when a payment request is created.
- `never_expires=true` takes precedence over an expiry input and persists the explicit year-9999 sentinel.
- Payment and notification lists are tenant-scoped, newest-first, and capped to 1–30 rows per request.
- The integration page documents create, status, payment list, notification list, and signed webhook contracts with JSON examples.
- Internal bank-facing `BillInquiry` and `BillPayment` endpoints are intentionally absent from the organization documentation.
- `/org/reference` and `/org/api-reference` both resolve to `/org/api-integration`.
- The organization payments page was simplified into a professional payment-request/reconciliation view; tenant manual payment controls and the public health panel were removed.

### Realtime behavior

- School and organization realtime pages no longer poll every few seconds.
- Authenticated server-sent events notify the correct tenant after a committed payment or reversal; the dashboard then refreshes its server-paginated data.
- Outbound webhooks remain the correct server-to-server integration. A browser cannot safely receive an organization's webhook, so SSE is used only for the signed-in dashboard.
- The current event bus is process-local. Production must keep one API process until shared Redis/pub-sub or another durable fan-out is added for multi-process delivery.

### Isolated sandbox

- Sandbox mode requires a database whose name contains `sandbox`, `uat`, or `test` and does not expose the 1LINK routes.
- The release includes a guarded bootstrap script, a dedicated PM2 API/worker definition, and an Nginx virtual host for `sandbox.fintap.pk`.
- `FINTAP_ENV_FILE` makes the selected sandbox file authoritative even if the PM2 daemon inherited stale production variables. This prevents accidental reuse of the production database.
- Health and readiness responses identify the active environment so deployment checks can prove that the two hostnames reach different runtimes.
- Production provisions a same-ID test tenant through an authenticated internal control endpoint and returns a `fintap_test_` key.
- Test keys are rejected by production and live keys are rejected by sandbox scope checks.
- Demo consumers/invoices/payments remain in the sandbox database only.
- Activation fails closed unless sandbox purge succeeds; after purge, the old test key no longer authenticates and the sandbox navigation is closed for the live tenant.
- The test key is held in page memory rather than browser storage.
- The sandbox is an optional external dependency for core API availability. If it is not configured, production starts with a warning while sandbox provisioning and tenant activation remain blocked with an explicit service error.

### Dashboard and scale work

- The admin dashboard includes a server-paginated **Consumer Numbers** registry covering school students, organization applicants, and organization payment requests across current and offboarded tenants. It filters by search, biller, source, tenant type/status, lifecycle, record status, identifier length, and archive state.
- Invoice rows are deliberately not duplicated in the registry because an invoice reuses its student's consumer number; each issued identifier appears under the source that allocated it.
- The global header search was removed from every dashboard.
- Server-backed searches use a 300 ms debounce so typing does not trigger a request/render cycle per keystroke.
- Sidebars collapse/expand and retain their state. Main content has explicit bottom padding and horizontal shrink handling.
- The school realtime “This Session” metric was removed.
- Composite `(tenant_id, created_at, id)` / `(tenant_id, sent_at)` indexes support high-volume newest-first lists.
- A disposable integration scenario inserted 2,105 students and 2,105 organization payment records, confirmed fixed-size first/last pages and tenant totals, then removed every generated row. The scenario completed in 2.332 seconds locally and each list stayed under its 8-second test ceiling. This proves functional pagination at the requested size; it is not a substitute for production load testing.

### FetchBundle retirement

- FetchBundle UI, routes, controllers, authentication coupling, reserved-field behavior, and active seed data are retired.
- `bill_bundles`, `bundles`, and `bundle_pcids` remain as unused rollback-only tables for one compatibility release, as required by the approved plan.
- Do not drop those production tables until 1LINK confirms invoice-only scope in writing, the data is exported, access logs show no callers for the agreed window, and a reviewed forward migration is approved.

## Database changes

The following additive, checksum-tracked migrations were applied successfully to both `Fintap_local_qa` and `Fintap_sandbox_qa`:

- `008_api_key_recovery.js` — adds nullable `tenants.api_key_encrypted`.
- `009_org_customer_name.js` — adds nullable `org_payment_records.customer_name`; the application requires it for new requests while preserving legacy rows.
- `010_tenant_list_indexes.js` — adds composite tenant/time list indexes.

- `011_consumer_registry_indexes.js` — adds the organization-applicant tenant/time index used by the admin consumer registry.

The API now validates the complete checksum-tracked JavaScript migration set before opening its HTTP listener. A missing migration therefore produces an explicit startup failure with the missing filename instead of allowing a later `Unknown column` SQL 500.

The production database still requires backup, restore validation, migration rehearsal on a current sanitized copy, and an approved deployment window.

## Verification evidence

| Verification | Result |
|---|---:|
| TypeScript typecheck | Pass |
| Frontend ESLint | Pass, 0 errors; 7 existing Fast Refresh warnings in shared UI primitives |
| Server ESLint | Pass |
| Frontend production build | Pass, 2,357 modules |
| Frontend Vitest | 1/1 pass |
| Server JavaScript syntax | 64 files pass |
| Server unit tests | 33/33 pass across 10 suites |
| Authenticated disposable-DB integration tests | 11/11 pass, including admin-only consumer-registry filtering |
| Stateful browser security/lifecycle/payment/sandbox/registry tests | 6/6 pass in the consolidated run |
| Route-by-route browser audit | 34 dashboard routes + 2 reference aliases pass; no page exceptions or API 5xx |
| Frontend production dependency audit | 0 known vulnerabilities |
| Server production dependency audit | 0 known vulnerabilities |
| Disposable test cleanup | Pass; no active matching QA tenant remains. Soft-deleted offboarding/audit stubs are intentionally retained in the disposable local database. |

Visual evidence was reviewed at:

- `test-results/admin-payment-verification.png`
- `test-results/org-testing-sandbox.png`
- `test-results/route-smoke-admin.png`
- `test-results/route-smoke-school.png`
- `test-results/route-smoke-org.png`
- `test-results/admin-consumer-registry.png`

The native computer-control plugin could not initialize because its local kernel assets were unavailable. Chromium was therefore run through the repository's Playwright installation; it exercised the real localhost frontend and APIs and produced the screenshots above.

## Production release blockers and gates

The software should not be described as live-production-ready until all of these are complete:

1. Deploy a separate sandbox hostname, API process, database user/database, TLS certificate, secrets, logging, and retention policy. Do not route it through the production 1LINK VPN.
2. Configure production `ADMIN_ACTION_PIN`, stable backed-up `API_KEY_ENCRYPTION_KEY`, `SANDBOX_BASE_URL`, and matching `SANDBOX_PURGE_SECRET`. Never print them or commit them.
3. Rehearse migrations `008`–`011` and rollback-compatible application deployment on a current production-like restore; run reconciliation queries before and after.
4. Configure Nginx for non-buffered SSE and verify reconnects through `https://app.fintap.pk`; keep one API instance until shared event fan-out exists.
5. Run sustained load tests representing at least 100 tenants, realistic concurrent sessions, webhook retry pressure, and projected row growth. The 2,105-row check is a pagination proof, not capacity certification.
6. Verify encrypted off-host backups and perform a timed restore drill.
7. Start and monitor the durable outbox worker, alert on failed/dead events, database saturation, authentication abuse, and reconciliation mismatches.
8. Obtain written 1LINK confirmation for the cipher/selectors, consumer-number test slab, response contracts, and FetchBundle exclusion; execute UAT and obtain formal go-live approval.
9. Resolve the existing VPN dependency: the server sends IKE_SA_INIT to `103.248.140.4` but has received no response. 1LINK must activate/whitelist `178.238.236.126` before tunnel/UAT testing can proceed.

## Local runtime left available

For continued QA, XAMPP MySQL is listening on port 3306, the production-like local API on `127.0.0.1:3000`, the isolated sandbox API on `127.0.0.1:3001`, and Vite on `127.0.0.1:8080`. These are development processes and disposable databases, not a production deployment.

## Related records

- [Plan.md](../Plan.md)
- [reasons.md](../reasons.md)
- [ONBOARDING_SECURITY_SANDBOX_CHANGE_PLAN_2026-09-10.md](./ONBOARDING_SECURITY_SANDBOX_CHANGE_PLAN_2026-09-10.md)
- [BILLER_ACTIVATION_AND_ORG_ONBOARDING.md](./BILLER_ACTIVATION_AND_ORG_ONBOARDING.md)
- [PRODUCTION_DEPLOYMENT_RUNBOOK.md](./PRODUCTION_DEPLOYMENT_RUNBOOK.md)
