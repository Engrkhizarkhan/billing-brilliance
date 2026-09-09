# Fintap SaaS Evolution Plan

Status: implemented locally; staged release gates remain
Prepared: 7 September 2026  
Implementation authorized: 8 September 2026

Implementation evidence and remaining external/operational gates are recorded in `docs/FULL_APPLICATION_QA_AUDIT_2026-09-09.md`, `docs/IMPLEMENTATION_AUDIT_2026-09-08.md`, and `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`. This plan remains the design baseline; the original safety decisions were preserved during implementation.

## 1. Purpose

This document is the implementation plan for evolving Fintap into a safer multi-tenant billing platform for schools, organizations, and private agencies. It covers the requested payment-completion workflow, biller suspension, testing-to-live onboarding, selectable consumer-number lengths, removal of FetchBundle, a truly isolated client sandbox, and the production controls needed for more than 100 tenants.

This document began as the planning-only baseline. Implementation was subsequently authorized and completed in the local repository. No production data, VPN configuration, Nginx configuration, certificate, firewall, or live server runtime was changed. Current evidence and outstanding release gates are maintained in the linked implementation audit and runbook.

## 2. Review basis

The plan is based on a structural and targeted logic review of the repository:

- React/Vite frontend: 143 TypeScript/TSX files and approximately 23,890 lines.
- Express/MySQL backend and schema: 58 JavaScript/SQL files and approximately 10,218 lines.
- Three product surfaces: the React SaaS portal, the Express API, and a separate static marketing website.
- Current database schema: 29 tables in `server/src/db/schema.sql`.
- Current roles: platform `admin`, tenant `school`, and tenant `org`; `private_agency` exists as a tenant type and currently uses the organization-style role/flows.
- Current payment paths: internal billing payment, 1LINK BillPayment, organization callback, SaaS gateway payment, and direct invoice-status mutation.
- Current external integration: invoice-based 1BILL BillInquiry and BillPayment over the separately configured IKEv2 VPN.

Read-only baseline checks on 7 September 2026:

| Check | Result | Limitation |
|---|---:|---|
| TypeScript (`npx tsc --noEmit`) | Pass | Static types only |
| Frontend production build | Pass | Does not exercise business behavior |
| Frontend tests | 1/1 pass | Coverage is effectively only a harness check |
| Frontend lint | Pass with 7 warnings | Fast Refresh warnings in shared UI modules |
| Server unit/smoke tests | 13/13 pass | No live database workflows |
| Server JavaScript syntax | Pass | Syntax only |
| Root production dependency audit | Pass | Zero known vulnerabilities reported by current lockfile audit |
| Server production dependency audit | Pass | Zero known vulnerabilities reported by current lockfile audit |
| Database integration suite | Not run | Requires a disposable database; existing integration tests are stale |
| Browser end-to-end suite | Not present | Playwright configuration exists without product tests |
| Load/capacity test | Not present | Production capacity is not measured |

The working tree already contains user-owned modifications and 1BILL evidence files. Implementation must preserve them and begin with a reviewed branch/commit boundary.

## 3. Current architecture

```text
Browser dashboards
       |
       | HTTPS + JWT
       v
Nginx -> Express API -> MySQL
              ^
              |
       1LINK BillInquiry/BillPayment
       through the dedicated IPsec path
```

Important current characteristics:

- Route-level frontend lazy loading and bounded page APIs already reduce browser load.
- Most business tables include `tenant_id`, but tenant enforcement is repeated in controllers and is not consistently applied.
- Tenant `status` already supports `active`, `suspended`, and `banned`, but it is not enforced across all JWT, 1LINK, callback, and internal payment paths.
- Consumer numbers are stored as `VARCHAR(24)`, but different creation paths currently generate different formats, mostly 20 digits.
- The organization “sandbox” currently calls the same `/api` methods and database as normal organization pages. It is a test console, not an isolated sandbox.
- Multiple controllers independently write payment, transaction, invoice, ledger, notification, and audit state. Their behavior is not identical.
- FetchBundle is coupled to admin pages, three database tables, 1LINK inquiry parsing, SaaS API-key authentication, consumer registration, mocks, tests, and documentation.

## 4. Target architecture

```text
                         +----------------------------+
Client production UI -->| Production API             |
1LINK VPN ------------->| - live tenants only        |--> Production MySQL
                         | - production credentials   |--> Durable outbox/worker
                         +----------------------------+

                         +----------------------------+
Client sandbox UI ------>| Sandbox API                |
Test simulator --------->| - synthetic data only      |--> Separate Sandbox MySQL
                         | - sandbox credentials      |
                         | - no production VPN access |
                         +----------------------------+

Platform administration controls tenant lifecycle, but never mixes sandbox
financial rows or sandbox credentials into production storage.
```

The application can remain a modular monolith. The expected initial size—at least 100 tenants and 2,000 transactions per tenant, or roughly 200,000 transactions—is well within a correctly indexed MySQL/Express system. A microservice rewrite is not justified before measured bottlenecks exist.

## 5. Non-negotiable implementation guardrails

1. Do not change the established production VPN addressing or StrongSwan configuration as part of application feature work.
2. Never null, regenerate, or rewrite existing consumer numbers to suspend a biller.
3. Never mark a financial item paid by changing only a status column.
4. Every payment posting must be atomic and idempotent.
5. Every tenant-owned query must have an enforced tenant boundary unless it is an explicitly authorized platform-wide admin query.
6. Sandbox data, credentials, processes, databases, and network access must be isolated from production.
7. Database changes must be additive and backward-compatible before old columns/routes are retired.
8. Production migrations require a backup and a tested restore, not only a migration script.
9. Existing 1BILL behavior must be regression-tested before and after payment refactoring.
10. “Production ready” is an evidence-based release decision, not a label applied after the build succeeds.

## 6. Priority-zero correctness and isolation gate

These pre-existing issues must be addressed before the requested features are enabled. Otherwise, new UI controls would sit on unsafe foundations.

### 6.1 Central tenant-state enforcement

Create a single middleware/service that loads the tenant and enforces account status and lifecycle for every tenant request. It will distinguish:

- authentication: who the caller is;
- authorization: what the caller may do;
- tenant scope: which tenant owns the resource;
- account status: active, suspended, or banned;
- lifecycle stage: testing, ready for activation, live, or offboarding;
- environment: sandbox or production.

Apply it to JWT sessions, API keys, the SaaS API, internal billing routes, reports, and resource-by-ID endpoints.

Effects:

- A suspended tenant cannot continue through an existing JWT or API-key session.
- A tenant cannot query or mutate another tenant’s resources by knowing an identifier.
- Platform-wide admin access remains explicit and audited.

### 6.2 Close identified tenant-scope gaps

The implementation review must explicitly correct and test at least these paths:

- Organization payment lookup currently selects by `application_id` without `tenant_id`.
- Transaction detail currently selects by transaction row ID without a tenant predicate.
- Internal `/api/billing/inquiry` and `/api/billing/payment` authenticate a tenant key but look up a consumer globally.
- The organization callback route does not run the same tenant API-key middleware as other integration requests; header presence and a global HMAC secret are not a complete tenant identity.
- The organization expiration endpoint can expire pending records across all tenants when called by an authenticated tenant user.
- JWT authentication verifies user status but does not consistently enforce the owning tenant’s status.
- 1LINK student and organization lookups join `tenants` but do not currently require a live, active tenant.

Add negative integration tests proving that Tenant A cannot read, pay, expire, or update Tenant B’s records through any identifier-based endpoint.

### 6.3 Repair known 500-producing creation paths

Before consumer-length work, repair and test the shared creation foundations:

- `applicantController.createApplicant` references `serviceId` before it is defined and uses `applicants.seq_number`, while the consolidated schema does not define that column.
- The SaaS `register-consumer` path inserts a student without values for current non-null fields such as father name, class, and gender.
- Centralize consumer-number generation so student, applicant, organization payment, and SaaS registration do not drift.

These repairs require disposable-database tests reproducing the current failure first, followed by success and rollback tests.

### 6.4 Replace unsafe direct “paid” mutation

The current invoice status endpoint can set an invoice to `paid` without creating a payment row, a transaction, or a correct ledger credit. Until the canonical payment service is implemented:

- prevent the status endpoint from being used to set `paid`;
- retain controlled `pending`/`overdue` maintenance if needed;
- route all paid outcomes through the payment-posting service described below.

### 6.5 Establish a real migration ledger

Replace ad hoc startup normalization and consolidated-schema assumptions with ordered, versioned migrations recorded in a `schema_migrations` table. Startup should verify schema compatibility but should not perform unreviewed production DDL.

Acceptance criteria for Phase 0:

- Every resource-by-ID and integration test has cross-tenant negative coverage.
- Known applicant and SaaS registration 500 errors have reproducing regression tests and pass after correction.
- A direct invoice status call cannot create an accounting-incomplete paid invoice.
- Production starts only when its schema version is compatible.

## 7. Feature 1 — Manual payment completion

### 7.1 Product behavior

Add a “Record payment” action to the appropriate unpaid invoice/payment-request page. It should be a financial posting form, not a simple status toggle.

Recommended permissions:

- platform admin: permitted for support/operations, with mandatory tenant selection and reason;
- school finance/admin: permitted for its own tenant;
- organization/private-agency finance operator: permitted only if the role is explicitly granted;
- staff/viewer: denied;
- external tenant API key: denied unless a separately scoped payment-posting credential is issued.

Required modal fields:

- target invoice or organization payment request;
- consumer number and payer name, read-only;
- outstanding amount, read-only;
- amount received;
- received date/time in the operator’s display timezone, stored in UTC;
- channel such as cash, bank transfer, counter, cheque, or adjustment;
- unique external reference/receipt number;
- mandatory reason/note for manual entry;
- typed confirmation showing tenant, consumer, and amount.

The result must clearly display the generated receipt and whether the balance is fully paid or partial.

### 7.2 Canonical payment-posting service

Introduce one server-side service used by:

- 1LINK BillPayment;
- school/manual payment;
- organization/manual payment;
- organization callback;
- SaaS payment API, if retained.

Inputs should include tenant ID, target type, target ID/consumer number, amount, currency, source, channel, external reference, received timestamp, actor, idempotency key, and note.

Within one database transaction it must:

1. lock the tenant and target billing rows in a documented order;
2. re-check that the tenant is active/live for the requested channel;
3. verify the bill exists, is unpaid, and belongs to the tenant;
4. reject duplicate external references/idempotency keys;
5. enforce the agreed exact/partial/overpayment rule;
6. create the canonical payment event;
7. create the transaction record;
8. allocate the payment to invoice(s);
9. update invoice or organization-payment state;
10. create ledger credit and any valid late-fee debit;
11. create a notification/outbox event;
12. create a financial audit record;
13. commit everything together or roll everything back.

Add a `payment_allocations` table so partial and multi-invoice payments are explainable. Do not infer a paid invoice only from the sum of unrelated payment rows.

Proposed payment metadata additions:

- `source`: `onelink`, `manual`, `org_callback`, `saas_api`, or `sandbox_simulator`;
- `status`: `posted`, `reversed`, or `voided` as appropriate;
- `created_by_user_id` for manual entries;
- `idempotency_key` and tenant-scoped unique external reference;
- `reason`, `currency`, and precise `received_at` timestamp;
- original/reversal linkage for future corrections.

### 7.3 1BILL behavior after a manual payment

After a production manual posting:

- BillInquiry must return the same paid state and paid metadata as it would after a successful 1LINK payment.
- A later 1LINK BillPayment for the same settled bill must return the contract’s “already paid” response without creating another financial event.
- Manual references must be distinguishable from 1LINK transaction authorization IDs.

### 7.4 Correction policy

Do not implement “unmark paid” by deleting rows or reverting statuses. A mistake should use a controlled reversal/correction event that preserves the original payment and audit history. If reversal is outside the first delivery, manual payments must carry a warning and support-only correction procedure.

### 7.5 Tests

- full payment, partial payment, overpayment rejection, duplicate reference, and duplicate idempotency key;
- two simultaneous payments for the same bill;
- suspension racing with a payment;
- database failure after each write step proves full rollback;
- school, organization, private-agency, and 1LINK variants;
- unauthorized role and cross-tenant attempts;
- paid inquiry and duplicate payment responses after manual completion.

## 8. Feature 2 — Suspend and restore a biller

### 8.1 Correct suspension model

Reuse tenant status but strengthen its semantics:

- `active`: normal access subject to lifecycle stage;
- `suspended`: temporarily disabled and reversible;
- `banned`: administratively disabled and not normally reversible by tenant operators.

Add suspension metadata: reason, suspended timestamp, suspended-by user, restored timestamp, and optional internal ticket/reference.

### 8.2 Consumer behavior

When a tenant is suspended:

- 1LINK BillInquiry and BillPayment must behave as if its consumer numbers are unavailable, using the contract-approved not-found/blocked response;
- production tenant API keys must be disabled by policy without being deleted;
- payment creation and all financial mutations must be blocked;
- scheduled invoice generation and webhook dispatch for that tenant must pause;
- client dashboards should be read-only with a prominent suspension notice unless the business chooses full login denial;
- historical data, consumer numbers, invoices, payments, and audit records remain intact.

When restored:

- the same consumer numbers and records become available again;
- keys do not need redistribution unless separately rotated;
- paused background work resumes according to an explicit catch-up policy;
- the restoration is audited.

### 8.3 Concurrency

Tenant status must be checked inside the same transaction and lock order as payment posting. This closes the race where an inquiry begins before suspension and commits a payment after suspension.

### 8.4 Admin experience

Use a confirmation modal that shows affected environment and behavior. Require a reason and target-specific confirmation. Display counts of active users, active consumers, pending bills, and queued callbacks, but do not update all those rows.

Acceptance criteria:

- suspension is effective for new requests immediately after commit;
- all consumer numbers appear unavailable through 1LINK while stored values remain unchanged;
- existing JWT/API-key sessions cannot bypass suspension;
- restoration returns the same identifiers and history;
- platform admin can still inspect and audit the tenant;
- concurrent suspend/payment tests produce one deterministic outcome without partial state.

## 9. Feature 3 — Testing versus onboarded/live tenants

### 9.1 Separate lifecycle from suspension

Add a tenant lifecycle stage independent of tenant account status:

```text
testing -> ready_for_live -> live -> offboarding
                    ^          |
                    +----------+ only through audited admin actions
```

Suspension remains an override that can disable a tenant in any stage. A tenant can therefore be `active + testing`, `active + live`, or `suspended + live` without confusing the meanings.

### 9.2 Testing-phase dashboard

For schools, organizations, and private agencies in testing:

- show a persistent “Testing environment” banner;
- show sandbox credentials and sandbox endpoints only;
- show synthetic/test metrics, not production collections;
- disable or redirect production financial actions;
- provide onboarding checklist status: profile, API/webhook, IP allowlist, sample consumers, UAT, and admin approval;
- clearly label data as disposable.

### 9.3 Live activation workflow

Only a platform admin may activate production. The confirmation should verify:

- tenant details and type;
- consumer-number length and remaining identifier capacity;
- production API credential issued securely;
- callback URL and HMAC secret configured where applicable;
- source IP allowlist configured;
- required sandbox/UAT tests passed;
- support and settlement contacts recorded;
- activation reason/ticket recorded.

Activation should be idempotent and audited. It must not copy sandbox payment records into production.

## 10. Feature 4 — Selectable 14- or 24-digit consumer numbers

### 10.1 New-tenant behavior

Add a required consumer-number length option to biller creation:

- 24 digits: recommended/default;
- 14 digits: allowed only after a displayed capacity check and warning.

Store the selected format on the tenant. Make it immutable after the tenant has issued its first consumer number. Changing format later would invalidate references already shared with payers and 1LINK.

### 10.2 Existing tenants

Existing 20-digit consumer numbers must remain valid and unchanged. Migration must grandfather their current format. The new 14/24 selector applies to newly created tenants unless a separately approved identifier migration is designed with 1LINK.

### 10.3 Generator design

Replace separate generators with one tested service used by every creation path. The exact numeric format is:

```text
FINTECH_PREFIX + numeric tenant namespace + zero-padded tenant sequence
```

The service must:

- produce exactly the tenant’s configured length;
- remain numeric and at most 24 digits;
- include prefix `105172` in the confirmed production environment;
- calculate and display the maximum sequence capacity before tenant creation;
- allocate sequence numbers transactionally without using random IDs;
- enforce a unique database constraint and handle exhaustion explicitly;
- never reuse an old consumer number after soft deletion;
- support deterministic test fixtures without weakening production allocation.

With a six-digit prefix and a four-digit biller code, a 14-digit number leaves four sequence digits, or only 9,999 identifiers for the tenant’s lifetime. This may be adequate for a small school with stable student identifiers but is unsafe for an organization that creates a new consumer number per application/payment request. The UI must calculate the real capacity from the actual namespace and warn or prevent an unsuitable configuration.

### 10.4 Tests

- exact 14- and 24-digit generation;
- numeric prefix and tenant namespace validation;
- concurrent generation without duplicates;
- exhaustion boundary;
- existing 20-digit inquiry/payment regression;
- immutability after first issue;
- all student, applicant, organization payment, and external registration paths.

## 11. Feature 5 — Remove FetchBundle safely

The requested removal affects more than one screen. The current dependency graph includes:

- frontend routes `/admin/bundles` and `/admin/fetchbundle-sandbox`;
- admin sidebar entries and lazy imports;
- `BundleManagement`, `FetchBundleSandbox`, bundle API methods, services, types, mock data, and audit labels;
- external `POST /v1/Transaction/Fetchbundle`;
- internal `/api/billing/fetchbundle` and `/api/billing/bundles`;
- `bundleController`, bundle routes, and route mounts;
- `bill_bundles`, `bundles`, and `bundle_pcids` tables;
- bundle ID parsing and invoice auto-creation in `oneLinkController`;
- SaaS gateway authentication through `bundle_pcids.api_key`;
- optional bundle-based invoice creation in `register-consumer`;
- 1LINK E2E tests and several product/hand-over documents.

Removal sequence:

1. Obtain written confirmation that FetchBundle is outside the contracted invoice-only 1BILL scope.
2. Decouple retained SaaS APIs from `bundle_pcids` by moving them to scoped tenant API credentials.
3. Replace optional `bundleId` consumer registration with an explicit invoice/payment-request contract, if that external API is retained.
4. Stop auto-creating invoices from a bundle ID embedded in 1LINK reserved data. Continue validating the external reserved field according to the confirmed 1LINK contract, but treat unused data as opaque.
5. Disable and return a documented retirement response for FetchBundle for one compatibility release if any caller may still use it.
6. Remove route mounts, controllers, frontend routes/navigation/pages, API methods, services, mock data, types, tests, and current documentation references.
7. Export and back up bundle/PCID data.
8. Drop obsolete tables only in a later migration after logs prove there are no callers and the rollback window has expired.
9. Update 1BILL UAT tests to cover only BillInquiry and BillPayment.

Do not remove school fee plans or payment-plan assignments. Those are internal billing concepts and are not the same as the external FetchBundle feature.

## 12. Feature 6 — A truly isolated client sandbox

### 12.1 Isolation boundary

Provision a separate environment, not a flag in the production database:

- separate hostname, such as `sandbox.app.fintap.pk` and `sandbox-api.fintap.pk`;
- separate API process/service account;
- separate MySQL database and database user;
- separate JWT, API, webhook, encryption, and signing secrets;
- sandbox-only API key prefix/identifier;
- separate logs, metrics, rate limits, backups, and retention;
- no route to the production 1LINK VPN/protected network;
- no access to production SFTP or settlement destinations;
- synthetic data only.

The same versioned code artifact should be deployed to sandbox and production to avoid behavioral drift, but configuration and data must remain separate.

### 12.2 Sandbox payment simulator

Provide deterministic controls for clients to simulate:

- unpaid inquiry;
- paid payment;
- duplicate payment;
- invalid amount;
- expired or blocked consumer;
- delayed callback, timeout, and retry;
- webhook signature success/failure;
- 14- and 24-digit consumers.

Simulator events must be unmistakably marked `sandbox_simulator` and cannot be promoted into production. Sandbox reset should be asynchronous, tenant-scoped, confirmed, audited, and recoverable within its stated retention window.

### 12.3 Credential separation

- Production must reject sandbox credentials.
- Sandbox must reject production credentials.
- Secrets should be displayed once, stored hashed where verification permits, and rotated with a short overlap/grace mechanism rather than an immediate destructive replacement.
- API credentials should carry tenant, environment, scopes, creation time, last-used time, expiry, and revoked time.

## 13. Scale and performance plan

### 13.1 Capacity model

Use these initial test volumes:

- minimum: 100 tenants × 2,000 consumers/transactions = 200,000 rows per major entity;
- growth test: 100 tenants × 10,000 consumers and at least 1,000,000 transactions;
- concurrency profiles: tenant dashboard traffic, bulk monthly billing, organization API creation, and 1LINK inquiry/payment bursts.

### 13.2 Query and index work

Capture `EXPLAIN ANALYZE` before changing indexes. Likely composite-index candidates include:

- transactions by tenant, status, date, and creation order;
- payments by tenant, date/channel, and creation order;
- invoices by tenant, status, due date, and student;
- organization payment records by tenant, status, and creation/paid date;
- audit logs by tenant, actor, action, and creation date;
- tenant-scoped idempotency/reference keys.

Avoid adding every possible index: each index makes financial inserts slower. Add only indexes proven by production-like query plans.

Reduce generic page-size limits from the current maximum of 10,000 to a safe bounded value, normally 100 or 200. Use server-side export jobs for complete data exports. Move high-offset platform-admin feeds to cursor/keyset pagination.

### 13.3 Background work

Move long or retryable operations out of browser requests:

- bulk invoice generation;
- large CSV exports;
- payment expiration;
- webhook delivery;
- notifications;
- settlement import/reconciliation when implemented.

Use a durable queue or database outbox, idempotent workers, retry with exponential backoff, dead-letter handling, replay controls, and per-tenant fairness. A browser page opening must not be the scheduler for expiring payments.

### 13.4 Rate limiting and horizontal scale

The current in-memory rate limiter is per Node process. Before adding multiple API instances, use a shared rate-limit store and keys based on endpoint type, tenant/API credential, and source IP. Keep a dedicated 1LINK policy that cannot be exhausted by dashboard traffic.

Connection-pool size must be set from measured database capacity and multiplied by the number of API/worker processes. An unlimited request wait queue should be replaced with bounded backpressure and observable saturation.

### 13.5 Performance acceptance targets

Confirm contractual 1LINK timings before finalizing numbers. Provisional internal targets for staging:

- ordinary paginated reads: p95 under 300 ms and p99 under 800 ms;
- payment posting: p95 under 500 ms, with zero duplicate financial events;
- 1LINK inquiry/payment: within the 1LINK-confirmed timeout with headroom;
- bulk operations: asynchronous, resumable/idempotent, with visible progress;
- no tenant can starve other tenants’ API or worker capacity;
- no unbounded memory growth during full exports or batch generation.

## 14. Professional production controls

### 14.1 Authorization

The schema contains roles and permissions, but most routes use coarse role checks. Define and enforce a permission matrix for tenant administration, billing creation, payment posting, correction/reversal, reports, API credentials, suspension, live activation, impersonation, and sandbox reset.

Admin impersonation should be read-only by default. Any mutating maintenance action must retain the real administrator identity, the represented tenant identity, and a reason.

### 14.2 Secrets and sessions

- stop returning full tenant API keys in normal tenant/profile/list responses;
- replace plaintext API-key storage with identifier + hash, with one-time secret display;
- move refresh tokens toward hashed server storage and secure HttpOnly cookie delivery;
- do not keep integration secrets in browser localStorage;
- support scoped keys, expiry, rotation overlap, revocation, and last-used metadata;
- preserve the existing typed regeneration confirmation until the improved rotation model replaces it.

### 14.3 Financial audit and reconciliation

- financial event audit must commit with the payment rather than fail silently;
- maintain append-only payment/reversal history;
- record actor, source, tenant, timestamps, before/after state, and correlation IDs;
- create daily reconciliation between payments, transactions, allocations, ledgers, invoices, organization records, and eventually 1LINK T+1 settlement files;
- alert on any break instead of automatically modifying financial data.

### 14.4 Webhooks

Replace fire-and-forget delivery with an outbox/worker model. Record attempts, response codes, next retry, redacted error, delivery state, and replay actions. Preserve HTTPS/SSRF checks and HMAC signing. Use per-tenant secrets and tenant-scoped idempotency keys.

### 14.5 Observability and operations

Add structured correlation IDs and metrics for request rate, latency, errors, database pool saturation, queue depth, worker failures, callback delivery, duplicate payments, rejected tenant access, and 1LINK response codes. Define alerts and runbooks.

Add CI gates for typecheck, lint, tests, build, migration validation, dependency audit, and secret scanning. Add separate staging deployment, controlled production release, smoke checks, rollback criteria, daily backups, and restore drills.

### 14.6 Documentation cleanup

Current READMEs and workflow documents contain stale routes, old ETEA names, old table counts, mock-first statements, and organization-dashboard decisions that no longer match the current application. Update them only after the implementation contract is frozen so the documentation describes actual behavior.

## 15. Proposed delivery phases

### Phase A — Contract and baseline freeze

Deliverables:

- approve decisions in `reasons.md`;
- define payment permissions, partial-payment policy, suspension dashboard behavior, and 14-digit eligibility;
- obtain FetchBundle scope confirmation;
- snapshot sanitized production schema and representative volumes;
- create a clean implementation branch and record current user-owned changes;
- define API compatibility and rollback windows.

Exit gate: no unresolved business decision can change the proposed schema or external API contract.

### Phase B — Security/correctness foundation

Deliverables:

- tenant context/status/lifecycle middleware;
- scope fixes and negative isolation tests;
- applicant/SaaS registration repairs;
- versioned migration runner;
- direct-paid status path disabled;
- disposable MySQL integration-test environment.

Exit gate: cross-tenant tests and known 500 regressions pass.

### Phase C — Canonical payments and manual completion

Deliverables:

- payment-posting service and allocation model;
- refactor 1LINK, manual, callback, and retained SaaS payment paths to it;
- manual payment modal and RBAC;
- receipt, audit, notifications/outbox;
- concurrency/idempotency/rollback tests.

Exit gate: all payment invariants and 1BILL post-payment behavior pass.

### Phase D — Suspension and lifecycle

Deliverables:

- suspension metadata, policy enforcement, admin modal, read-only tenant banner;
- testing/ready/live lifecycle and activation checklist;
- scheduler/worker pause and resume policy;
- race-condition tests.

Exit gate: suspension/restoration and testing/live matrices pass across every entry point.

### Phase E — Consumer-number policy

Deliverables:

- tenant creation selector and capacity display;
- centralized allocator and immutable format;
- existing-number compatibility migration;
- exhaustion and concurrent-generation tests.

Exit gate: all four consumer creation paths and 1BILL tests pass for supported lengths.

### Phase F — FetchBundle retirement

Deliverables:

- retained SaaS authentication decoupled;
- FetchBundle callers disabled/observed;
- code/UI/routes/tests/docs removed;
- data export and delayed table-drop migration.

Exit gate: no logs/callers depend on FetchBundle and invoice-based 1BILL UAT still passes.

### Phase G — Isolated sandbox

Deliverables:

- separate infrastructure, database, credentials, and hostname;
- deterministic payment simulator;
- tenant test onboarding and reset workflow;
- environment-bound credential verification;
- proof that sandbox cannot route to production DB, secrets, SFTP, or VPN.

Exit gate: isolation tests and an external penetration/configuration review pass.

### Phase H — Scale, resilience, and release

Deliverables:

- evidence-based indexes and query changes;
- queue/outbox workers;
- full integration/browser/load/soak tests;
- dashboards, alerts, runbooks, backup/restore evidence;
- staging migration rehearsal and production rollback package;
- updated system/API/operator documentation.

Exit gate: approved performance, security, data-integrity, operations, and 1LINK UAT evidence.

## 16. Test matrix required before production

| Area | Minimum required evidence |
|---|---|
| Tenant isolation | Tenant A cannot read/write Tenant B through every list, ID, consumer, callback, report, export, or admin-support path |
| Manual payment | Atomic full/partial behavior, duplicate prevention, permissions, audit, receipt, inquiry state |
| 1LINK | unpaid, paid, overdue, blocked, invalid, duplicate, timeout/retry, 14/20/24-digit compatibility as agreed |
| Suspension | all entry points blocked, identifiers preserved, restore behavior, in-flight race |
| Lifecycle | testing cannot touch production; activation checklist and audit |
| Sandbox | separate DB/secrets/network, deterministic simulations, reset isolation |
| Consumer allocation | concurrency, capacity/exhaustion, immutability, uniqueness |
| Performance | 200k baseline, 1m growth, dashboard/payment/batch profiles, p95/p99 and query plans |
| Resilience | database/network/webhook failures, retry, restart, rollback, restore |
| Security | RBAC, API-key scope, session revocation, SSRF/HMAC, rate limiting, secret scan |
| Reconciliation | no mismatch among payments, transactions, allocations, ledgers, invoice/org status |

## 17. Deployment and rollback sequence

1. Freeze the release contract and create a sanitized production-like staging database.
2. Take a backup and perform an actual restore test.
3. Apply additive migrations in staging and run invariant queries.
4. Deploy compatible backend code before enabling new frontend controls.
5. Run automated tests, load tests, and 1BILL regression/UAT tests.
6. Deploy sandbox separately and prove isolation.
7. During production release, take a new backup, apply migrations, deploy the backend, run readiness/smoke tests, then deploy the frontend.
8. Keep new features behind server-controlled feature flags until their checks pass.
9. Monitor errors, payment invariants, database saturation, and 1LINK results.
10. Roll back application code only when the schema remains backward-compatible; otherwise use a reviewed forward-fix. Never restore a database over newer valid payments without a reconciliation decision.

## 18. Definition of done

The work is complete only when:

- all approved requested behaviors are implemented server-side and in the correct dashboards;
- consumer numbers are preserved under suspension and exact-length generation is proven;
- all financial posting paths use one atomic service;
- FetchBundle is removed without breaking retained SaaS or invoice-based 1BILL contracts;
- sandbox and production are demonstrably isolated;
- no known cross-tenant access gap remains;
- database, browser, contract, failure, concurrency, and load tests pass;
- migrations and rollback have been rehearsed on production-like data;
- monitoring, alerting, backups, restore, reconciliation, and runbooks exist;
- documentation matches the deployed behavior;
- 1LINK UAT and the relevant operational owners approve go-live.
