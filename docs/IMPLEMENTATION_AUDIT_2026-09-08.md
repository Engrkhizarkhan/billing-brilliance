# Fintap implementation and production-readiness audit

Prepared: 8 September 2026  
Scope: execution of `Plan.md` and `reasons.md` against the local repository

Superseded for runtime QA evidence by `docs/FULL_APPLICATION_QA_AUDIT_2026-09-09.md`.

## Executive result

The planned application changes are implemented locally and the build/unit/dependency gates pass. The release is not yet production-certified because the migration has not been rehearsed against a copy of the production `Fintap` database, the isolated sandbox infrastructure is not provisioned, load/restore drills are not complete, and 1LINK has not responded to IKEv2 or completed joint UAT. Those are release gates, not application-code failures.

No command in this implementation changed the production VM, Nginx, StrongSwan, loopback address, firewall, certificate, or live database.

## Implemented changes and reasons

| Area | Implemented outcome | Why |
|---|---|---|
| Payment completion | School and organization invoice pages have a confirmed **Record payment** flow. 1LINK, tenant API, organization callback, and manual paths use one atomic posting service, including ledger-only balances. | A paid status alone would leave payments, transactions, allocations, ledger, receipts, notifications, audit and reports inconsistent. |
| Payment correction | Manual payments have a typed-confirmation reversal that creates a compensating payment, transaction, ledger entry, audit event and outbox event. External/1LINK payments are excluded. | Financial history must be corrected, not overwritten or deleted; settled external payments require reconciliation with the external party. |
| Duplicate protection | Tenant-scoped external reference plus idempotency key checks run under transaction locks. 1LINK uniqueness uses consumer number, auth ID, date and time. | Gateway retries and concurrent operators must not post twice. |
| Biller suspension | One tenant-state change immediately blocks writes and makes consumers unavailable to 1LINK, while preserving every consumer identifier and record. Restore re-enables the existing data. | Nulling thousands of consumer numbers would destroy reconciliation history and create restore/collision risk. |
| Biller offboarding | A suspended biller can be offboarded only through a reason plus exact-name modal. Access/key is revoked; financial records remain. | Hard deletion is inappropriate for a payment system and would violate audit/reconciliation needs. |
| Testing/live lifecycle | Account status is separate from `testing`, `ready_for_live`, `live`, and `offboarding`. Live activation requires a typed confirmation and five-point checklist. | Operational suspension and onboarding readiness are different facts. |
| Consumer identifiers | A centralized, transaction-locked allocator supports new 14- or 24-digit policies, preserves existing 20-digit identifiers, calculates capacity, and advances beyond legacy namespaces across all consumer tables. | Random or per-controller generation causes collision/race risk. Existing externally issued identifiers cannot safely be reformatted. |
| FetchBundle | External route, controllers, admin pages, sandbox page, client methods, types, mock fixtures and stale E2E flow were removed. Legacy tables remain quarantined for one rollback release and have no code reader. | The stated onboarding scope is invoice-based. Delayed table drop preserves rollback safety; written 1LINK scope confirmation remains required. |
| Organization portal | Dashboard, payments, real-time payments, invoices, reports, history and professional API JSON reference remain. `/org/reference` redirects to the working integration reference. | Restores operational visibility while keeping integration guidance centralized. |
| Sandbox | The production UI no longer simulates writes against production. It links only to `VITE_SANDBOX_BASE_URL`. The backend has an `APP_ENVIRONMENT=sandbox` guard, requires a sandbox-named database, disables 1LINK routes, and scopes sandbox API keys as test keys. | A label or table flag is not isolation. Test writes require a separate hostname, process, DB/user, secrets and logs with no production VPN route. |
| Credentials/sessions | Tenant API keys are generated once, stored only as SHA-256 hashes, displayed once, and regenerated behind typed confirmation. Refresh tokens are HttpOnly/Secure/SameSite cookies and only their hashes are stored. Browser access tokens use session storage. | Reduces database and browser secret exposure and makes rotation deliberate. |
| Webhooks | Financial events insert a transactional outbox row. A separate worker claims events, signs the exact body, validates public HTTPS destinations, retries with exponential backoff, and records failures. | Fire-and-forget callbacks are lost during restarts and cannot be reconciled. |
| Access hardening | New/reset passwords require at least 12 characters, generated temporary passwords use cryptographic randomness, API keys are bound to the production or sandbox scope, and inactive consumers are hidden from tenant APIs. | Predictable credentials and cross-environment keys are avoidable access risks. |
| Administration at scale | Biller and user tables use server-side filtering/pagination; tenant selectors load every tenant page; the fake three-user import was replaced with validated CSV processing and explicit partial-failure reporting. | Client-side first-page filtering silently hides records once the platform exceeds 100 tenants/users. Simulated imports are unsafe in an operational console. |
| Production surface cleanup | Removed the stale admin developer page, bcrypt comparison endpoint, dead mock API/data, and misleading “reveal tenant keys” UI. | Debug/password-oracle surfaces and mock operations do not belong in a production operations console. One-time API-key secrets cannot be retrieved later by design. |
| Tenant isolation/RBAC | High-risk lookups and mutations are tenant-scoped. Organization users cannot use school APIs; school staff cannot manage users or financial configuration; admin/finance boundaries are enforced. | UUIDs are not authorization. Every data boundary must enforce tenant and role policy. |
| Scale | Page sizes are bounded, common tenant/status/date indexes were added, gateway and tenant API rate limits are separate, and synchronous webhook work moved to a worker. | The expected initial volume is suitable for a well-indexed modular monolith; unsafe unbounded reads and synchronous side effects were the larger risks. |
| Schema/deployment | Migration `007_production_foundation.js` is additive and checksum-ledgered. Production startup fails closed if the migration is absent or security settings are unsafe. PM2 definitions include API and outbox worker. | Schema mutation during app startup and silent configuration fallbacks are unsafe in production. |

## Audit evidence

- Frontend production build: passed.
- TypeScript (`npx tsc --noEmit`): passed.
- Frontend Vitest: 1 test passed.
- Backend Jest: 6 suites, 24 tests passed, including current 1LINK contract tests.
- Public and authenticated database integration contracts: 4 tests passed against isolated XAMPP database `Fintap_local_qa`.
- JavaScript syntax check: passed for all backend source and test files.
- ESLint: zero errors; seven Fast Refresh warnings limited to existing shared UI primitive modules.
- `npm audit --omit=dev`: zero vulnerabilities for frontend and backend.
- `git diff --check`: passed after final implementation cleanup.
- XAMPP MySQL was started and used for a fresh migration/seed rehearsal, repeat-seed verification, authenticated integration tests, real 1BILL posting/replay tests, and a 2,125-student scale audit.

## Known release blockers

1. Rehearse backup, migration, integrity queries and rollback against a fresh copy of the production database.
2. Provision the separate sandbox hostname/database/user/secrets/certificate/process; set `VITE_SANDBOX_BASE_URL`.
3. Start the outbox worker under PM2 and prove retry/exhausted-attempt alerts. The worker automatically reclaims events abandoned in `processing` after a crash.
4. Run the documented load test target and record p95/p99 latency, DB lock waits, CPU and memory.
5. Perform a database restore drill and reconcile payment/invoice/ledger totals.
6. Obtain written 1LINK confirmation that `FetchBundle` is outside this invoice-service scope.
7. Obtain 1LINK confirmation that the requested 24-digit UAT consumer is accepted; the generic document also notes a 20-character limit at 1LINK.
8. 1LINK must whitelist/activate peer `178.238.236.126` and return IKEv2 traffic; then complete inquiry/payment/duplicate/paid/blocked/after-due-date UAT.

## Deliberately unchanged networking

The verified design remains: public endpoint `178.238.236.126`, protected local address `172.29.250.10/32`, 1LINK peer `103.248.140.4`, remote protected hosts `10.95.8.92/32` and `10.95.8.94/32`, HTTPS port `443`, IKEv2 AES-256/SHA-256/DH19/PFS. Outbound IKE_SA_INIT exists and no inbound reply has been observed; application changes cannot fix a silent peer.
