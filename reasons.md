# Fintap Architecture Decision Reasons

Status: proposed decisions for approval  
Prepared: 7 September 2026

## 1. Decision summary

| Request | Proposed decision | Main reason |
|---|---|---|
| Mark a payment paid | Add a confirmed manual payment-posting workflow backed by the same atomic service as 1LINK | A status-only change creates accounting inconsistencies and duplicate-payment risk |
| Suspend a biller | Gate the tenant at inquiry/payment/auth/worker boundaries; preserve stored consumer numbers | Nulling or regenerating identifiers damages history, references, and recovery |
| Testing versus onboarded | Add lifecycle stage separate from suspension | Testing readiness and account disablement are different business facts |
| 14 or 24 digits | Allow selection for new tenants, default to 24, calculate capacity, preserve existing 20-digit values | Existing identifiers cannot safely change; 14 digits can exhaust quickly |
| Remove FetchBundle | Retire it in dependency order after decoupling retained APIs and confirming the 1BILL scope | Immediate deletion would break SaaS API authentication and invoice creation paths |
| Separate sandbox | Use a separate runtime, database, credentials, and network boundary | A UI label or table flag cannot protect production data from test mutations |
| Support 100+ tenants | Keep a modular monolith, fix tenant enforcement/indexes/jobs, then measure | The projected row count does not justify premature microservices |

## 2. Decision: payment completion is an event, not a toggle

### Context

Fintap currently has several payment-writing implementations. The 1LINK handler uses a database transaction for most of its flow, while internal billing, SaaS payment, organization callback, and invoice status update behave differently. The invoice status endpoint can produce a paid invoice without a matching payment, transaction, and ledger credit.

### Decision

All paid outcomes will call one canonical payment-posting service. The UI action will be named “Record payment,” require payment evidence, and use a confirmation modal.

### Why

A payment changes multiple financial facts at once. If only `invoice.status` changes:

- payment history may omit the collection;
- reports and ledger totals disagree;
- 1LINK can see a paid bill without a traceable transaction;
- duplicate detection has no payment reference;
- reconciliation cannot explain who recorded the payment or why.

Atomic posting makes these records one indivisible event. Idempotency and row locking protect against refreshes, retries, simultaneous cashiers, and a 1LINK payment arriving at the same time.

### Effects

Positive:

- consistent receipts, reports, inquiry state, ledger, and audit;
- one place to fix allocation and duplicate behavior;
- safer manual and external integrations.

Cost/trade-off:

- existing payment handlers must be refactored, not merely connected to a button;
- database integration and concurrency tests are mandatory;
- a correction/reversal design is needed because financial history should not be deleted.

### Rejected approach

Do not expose a simple “Paid/Unpaid” switch. It is easy to build but unsafe for a financial system.

## 3. Decision: suspension hides consumers without changing them

### Context

The request describes making all of a suspended biller’s consumer numbers “none or not existing” and restoring them later.

### Decision

Keep consumer numbers unchanged in storage. When the owning tenant is suspended, the lookup/payment layer will return the contract-approved unavailable response and block writes. Restoration removes the gate.

### Why

Consumer numbers are external identifiers printed on bills, stored in payment histories, shared with 1LINK, and referenced by invoices and ledgers. Setting thousands of values to null or replacing them would:

- violate non-null and unique relationships;
- destroy the ability to reconcile old payments;
- require mass row updates and cache invalidation;
- risk collisions when values are restored;
- make suspension slow and failure-prone for large tenants;
- turn a reversible business action into a destructive data migration.

Policy enforcement produces the exact external behavior the request needs while preserving evidence.

### Effects

Suspension becomes immediate and cheap: update one tenant state, then enforce it at every boundary. Existing keys can remain assigned but unusable, so restoration does not require redistribution.

### Recommended dashboard behavior

Allow suspended tenants to log in read-only with a clear notice so they can view history and contact support. Block all financial and configuration mutations. A banned tenant can be denied completely. This is safer operationally than hiding the reason for suspension, but it remains a business-policy approval item.

## 4. Decision: lifecycle and account status are separate

### Context

“Testing,” “onboarded/live,” and “suspended” are currently being treated as similar switches, but they answer different questions.

### Decision

Use two independent dimensions:

- account status: active, suspended, banned;
- lifecycle: testing, ready for live, live, offboarding.

### Why

A tenant may be active in testing without permission to use production. A live tenant may be temporarily suspended. Combining these facts in one Boolean causes invalid transitions and unclear reporting.

### Effects

- onboarding progress can be shown without pretending a tenant is live;
- suspension can override either testing or live operation;
- activation can require an auditable checklist;
- reports can distinguish test tenants from revenue-producing tenants.

### Rejected approach

Do not reuse `status = suspended` to mean “not onboarded.” It would mix compliance readiness with enforcement and make later restoration ambiguous.

## 5. Decision: sandbox requires physical/logical environment isolation

### Context

The existing organization sandbox page calls the same API methods as ordinary pages. It writes to the same service and database; the word “Sandbox” is presently a UI description, not a safety boundary.

### Decision

Operate sandbox as a separate deployment with a separate database, database user, secrets, credentials, logs, and hostname. It must have no path to production 1LINK VPN, settlement SFTP, or production data.

### Why

An `environment = sandbox` column in the production database still permits application bugs, missing filters, operator mistakes, and leaked credentials to reach production rows. Separate infrastructure provides defense in depth and allows safe reset/seed operations.

### Effects

Positive:

- testing cannot corrupt live collections;
- sandbox data can be reset and retained under a different policy;
- sandbox credentials are harmless against production;
- client UAT becomes repeatable.

Cost/trade-off:

- an additional API process, database, hostname/certificate, monitoring, and deployment configuration are required;
- tenant onboarding metadata may need controlled provisioning in both environments;
- the two environments must deploy the same code version to prevent drift.

### Rejected approach

Do not implement sandbox as a frontend tab, a request header, or a shared-table Boolean only.

## 6. Decision: consumer-number length is immutable tenant policy

### Context

The schema accepts up to 24 digits, while different paths currently generate mostly 20-digit values. The requested admin choice is exactly 14 or 24 digits.

### Decision

- New tenants select 14 or 24 digits at creation.
- The default is 24 digits.
- The format becomes immutable after the first identifier is issued.
- Existing 20-digit identifiers remain valid and unchanged.
- One allocator generates identifiers for every product path.

### Why preserve existing 20-digit values

An existing consumer number is already an external contract. Reformatting it can cause failed inquiries, duplicate identifiers, incorrect payment attribution, and operational disputes. A schema preference cannot safely rewrite the identifiers already in use.

### Why default to 24 digits

With prefix `105172` and a four-digit biller code, a 14-digit identifier has only four digits left for a sequence: 9,999 lifetime identifiers. That can support a modest school using one stable number per student, but it is unsuitable for an organization that creates a new number for each application/payment request. Twenty-four digits provide much safer capacity.

### Why use a sequence instead of randomness

A short 14-digit namespace has too little room for collision-safe random allocation at meaningful volume. A transactional per-tenant counter is deterministic, capacity-aware, and easy to audit. A unique constraint remains the final safeguard.

### Effects

- tenant creation must validate numeric biller-code length and show capacity;
- organization/private-agency tenants may need 24 digits enforced unless their identifier lifecycle is changed;
- an exhaustion error and operational alert must exist;
- UAT must confirm that 14- and 24-digit values are accepted for the intended tenants.

## 7. Decision: remove FetchBundle in stages

### Context

The product is being onboarded for invoice-based 1BILL services and FetchBundle is not desired. However, FetchBundle code currently owns more than the external endpoint: `bundle_pcids` supplies SaaS API authentication, and bundle IDs can create invoices during registration or inquiry.

### Decision

First decouple retained functionality, then remove the endpoint/UI/code, then remove data tables after an observation and rollback period.

### Why

Deleting all bundle code and tables in one release would break:

- `/api/saas/v1` authentication;
- consumer registration that optionally creates an invoice from a bundle;
- 1LINK inquiry behavior when reserved data carries a bundle ID;
- the current E2E test setup;
- API references and operator workflows.

The staged sequence produces the requested end state without an avoidable outage.

### External-contract condition

Written 1LINK confirmation is recommended before permanently removing `POST /v1/Transaction/Fetchbundle`. The kickoff material says invoice services, which supports removal, but an external contract should not be inferred solely from UI requirements.

### Internal concepts retained

School fee plans, invoice generation, and payment-plan assignments are not FetchBundle and should remain.

## 8. Decision: keep the modular monolith for the current scale

### Context

The expected starting scale is more than 100 tenants with more than 2,000 transactions each—approximately 200,000 transaction rows, plus related records.

### Decision

Keep React + Express + MySQL as a modular monolith for now. Improve boundaries, queries, indexes, workers, observability, and tests before considering service decomposition.

### Why

MySQL can handle this row count comfortably when queries are tenant-scoped and indexed. The larger current risks are correctness, isolation, duplicate business logic, synchronous background work, and absent load evidence—not the absence of microservices.

### Effects

- lower operational complexity and fewer distributed-transaction problems;
- faster delivery of payment invariants and sandbox isolation;
- clear internal service modules are still required so later extraction is possible;
- architecture will be reviewed again using measured CPU, latency, lock, and queue data.

### Rejected approach

Do not split payments, tenants, reports, and integrations into networked microservices before the canonical transaction and contract boundaries are proven.

## 9. Decision: use background jobs for long and retryable work

### Context

Payment expiration is currently triggered from a dashboard page, webhook delivery is fire-and-forget, and bulk/export operations can grow beyond request timeouts.

### Decision

Use a durable queue/outbox and idempotent workers for scheduled, long-running, and retryable tasks.

### Why

A browser visit is not a scheduler. Fire-and-forget delivery loses notifications on process restart. Long HTTP requests encourage retries that can duplicate work. Durable jobs provide progress, retry, replay, and operational visibility.

### Effects

- additional worker process and queue/outbox storage;
- clearer API responses using job IDs for bulk operations;
- per-tenant fairness and concurrency limits become possible;
- monitoring and dead-letter procedures are required.

## 10. Decision: tighten API credentials and sessions

### Context

Tenant API keys are currently retrievable in database rows/profile responses and integration values are kept in browser localStorage. Refresh tokens are stored in plaintext. This is convenient but increases impact from database or browser compromise.

### Decision

Move toward one-time API secret display with hashed verification, environment/scoped credentials, rotation overlap, revocation, expiry, and usage metadata. Remove integration secrets from browser localStorage. Move refresh-token delivery to secure HttpOnly cookies and store a server-side hash where feasible.

### Why

Credential rotation should not require exposing the old secret repeatedly. Environment-bound scopes prevent a sandbox key from reaching production. HttpOnly cookies reduce token theft through browser script injection.

### Effects

- API list/profile responses show key identifiers and last-used metadata, not secrets;
- clients need a controlled migration/rotation window;
- browser authentication and CSRF protections must be tested together;
- the existing typed regeneration modal remains useful until the new credential lifecycle is delivered.

## 11. Decision: financial audit is transactional

### Context

General audit logging currently catches its own database errors so that audit failure does not fail a request. That is acceptable for some low-risk UI events but not for money movement.

### Decision

Financial audit/event rows and outbox records must use the same database transaction/connection as payment posting. General activity audit may remain fail-soft with alerting.

### Why

A successful payment without its financial evidence is a reconciliation failure. Conversely, a general page action should not necessarily take the platform down because an auxiliary audit write failed.

### Effects

- the code distinguishes financial events from general activity logs;
- financial posting fails and rolls back if its required evidence cannot be written;
- monitoring alerts on general audit failures.

## 12. Decision: do not claim production readiness without measured gates

### Context

Static checks currently pass, but only one frontend test and 13 server unit/smoke tests run. No disposable-database integration test, browser suite, multi-tenant isolation suite, load test, restore drill, or full sandbox exists.

### Decision

Call the current repository a working baseline, not production-certified. Production approval requires the exit gates in `Plan.md`.

### Why

Compilation proves that code can build; it does not prove financial atomicity, tenant isolation, race handling, performance, recovery, or external contract compliance.

## 13. Decisions intentionally deferred for approval

These choices materially affect workflow or contract behavior and should be confirmed before schema/API implementation:

1. Manual payment permissions: recommended platform admin plus tenant finance/admin, never viewer/staff by default.
2. Manual payment amounts: recommended exact invoice payment initially; enable partial payment only with the allocation model and clear receipt behavior. Reject overpayment until a credit-balance policy exists.
3. Suspended dashboard access: recommended read-only access with a suspension banner; banned accounts are denied.
4. Fourteen-digit eligibility: recommended for capacity-qualified school tenants only; default/enforce 24 digits for per-application organization/private-agency models.
5. Existing 20-digit tenants: recommended grandfathering; no mass identifier migration.
6. FetchBundle retirement: obtain 1LINK confirmation and decide whether to return a temporary retirement response for one release.
7. SaaS gateway scope: decide which `/api/saas/v1` endpoints remain after FetchBundle and whether external clients may post real payments.
8. Sandbox hosting: approve separate hostname, database, process, certificate, monitoring, and retention cost.
9. Reversal/refund scope: decide whether it is included with manual payments or delivered as a subsequent controlled workflow.
10. 1LINK error mapping for suspension: confirm whether suspended consumers should return not-found code `01` or a specific blocked response in every scenario.

## 14. Existing findings that influence the plan

These are planning findings, not changes made in this phase:

- organization status lookup lacks a tenant predicate;
- transaction detail lacks a tenant predicate;
- internal billing API-key routes do not use the authenticated tenant in consumer lookup;
- callback tenant identity and expiration scoping need correction;
- tenant suspension is not applied consistently to JWT and 1LINK traffic;
- invoice status can bypass payment/transaction/ledger creation;
- internal and SaaS payment paths are not one atomic transaction;
- applicant creation references an undefined `serviceId` and a schema column that is absent;
- SaaS consumer registration omits required student fields;
- the existing organization sandbox writes through normal APIs;
- organization and legacy ETEA controllers/services contain duplicated and drifting logic;
- generic pagination allows up to 10,000 rows;
- API keys and refresh tokens have retrievability/storage concerns;
- webhook delivery has no durable retry/outbox;
- integration tests and documents contain stale ETEA, route, table-count, and FetchBundle assumptions;
- CI/deployment manifests and real Playwright product tests are absent from the repository.

These items are included because leaving them in place would undermine the requested features and system health.

## 15. Networking decision

Application work must continue from the established VPN state without redesigning production networking:

- public endpoint: `178.238.236.126`;
- dedicated protected IP: `172.29.250.10/32`;
- 1LINK peer: `103.248.140.4`;
- 1LINK protected hosts: `10.95.8.92/32` and `10.95.8.94/32`;
- application HTTPS port: 443.

The lack of an inbound IKE response remains a 1LINK/upstream connectivity dependency. It is independent of this application plan. No feature phase should alter the working loopback/IPsec design merely to compensate for a peer that has not responded.

