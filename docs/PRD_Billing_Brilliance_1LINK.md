# Product Requirements Document (PRD)

## Billing Brilliance - Multi-Tenant Education and ETEA Payment Platform

Version: 1.0  
Date: 2026-04-05  
Prepared for: Billing Brilliance build roadmap  
Primary references: 1LINK/1BILL docs in docs/1Link and current application codebase

---

## 1. Executive Summary

Billing Brilliance is a role-based SaaS platform with three portals:

- Admin portal for multi-tenant platform control.
- School portal for student billing, collection, and financial operations.
- ETEA portal for application-level payment orchestration.

The product currently runs as a frontend-first, in-memory implementation. This PRD defines the production target architecture, behavior, and acceptance criteria, grounded in:

- Existing implemented UI workflows and service contracts.
- 1LINK Generic REST specification (Fetch Bundle, Inquiry, Payment).
- 1LINK data network and security standards.
- 1BILL aggregation model and callback lifecycle.

This PRD is intended to be the execution blueprint for building a production-grade system on top of the existing implementation and docs.

---

## 2. Problem Statement

Educational institutions and testing organizations need a reliable payment platform that can:

- Issue and track bills by stable consumer identifiers.
- Collect payments across multiple channels through 1BILL/1LINK rails.
- Maintain clear ledgering and auditability.
- Provide role-based operational dashboards.
- Support strict tenant isolation and secure callback handling.

Current pain points in the market and in the current implementation:

- Fragmented payment tracking across school and ETEA operations.
- Limited interoperability with standardized inquiry/payment contracts.
- Missing backend persistence and durable idempotency in the current mock implementation.
- Minimal automated testing and no production-ready observability.

---

## 3. Product Vision

Build a secure, multi-tenant payment operating system for education and test authorities that combines:

- Operational simplicity for school finance teams.
- Application-level payment orchestration for ETEA-like entities.
- Standards-compliant integration with 1LINK/1BILL.
- Enterprise controls (audit, security, reconciliation, monitoring).

---

## 4. Goals and Non-Goals

### 4.1 Goals

1. Deliver end-to-end billing and payment workflows for School and ETEA tenants.
2. Implement production-grade 1LINK transaction handling (inquiry, payment, bundle).
3. Enforce strict tenant isolation on all read/write operations.
4. Support secure callback processing with signature validation and idempotency.
5. Provide actionable analytics, realtime payment visibility, and audit trails.
6. Reach production readiness with persistence, reliability, and test coverage.

### 4.2 Non-Goals (Initial Release)

1. Owning ETEA applicant master data as system of record (source system remains owner).
2. Building custom bank rails outside 1LINK/1BILL contract.
3. Supporting non-Ethernet/wireless network connectivity models that violate 1LINK standards.
4. Delivering advanced BI/data lake features in MVP.

---

## 5. Stakeholders and Users

### 5.1 Internal Stakeholders

- Product owner
- Engineering lead
- Platform admin operations
- Compliance and security
- QA and support

### 5.2 External Users

- Platform Admin
- School Admin and school sub-users (admin, finance, staff, viewer)
- ETEA operations users
- Applicant/student payers (indirect users through payment channels)
- Integrating source systems (ETEA upstream, 1BILL downstream)

---

## 6. Current State Assessment (Codebase Baseline)

### 6.1 What is already implemented

- Role-based login and route segregation.
- Admin workflows: billers, users, transactions, audit, API sandbox.
- School workflows: students, fee plans, payment programs, invoices, ledger, scholarships, defaulters, payments, realtime payments, reports, settings, login activity.
- ETEA workflows: dashboard, postings, applicants (as references), payment controller, invoices, realtime payments, reports, settings.
- Mock service contracts for:
  - Bill inquiry/payment/fetch bundle.
  - ETEA create/lookup/callback/health flows.

### 6.2 Current technical limitations

- In-memory data model; no durable database writes.
- Default mock mode for 1BILL integrations.
- Security controls are simulated at frontend service level.
- No backend-enforced row-level tenant isolation.
- Minimal automated tests (single example test).
- No real queueing/retry/outbox for callbacks and downstream notifications.

### 6.3 Existing but unrouted ETEA modules

The following pages exist in source but are not wired in routing:

- Roll Assignment
- Admit Cards
- Results
- Service List
- ETEA Payment Programs

These can be promoted in a later release scope.

---

## 7. Scope Definition

### 7.1 MVP Scope (Production Release 1)

1. Multi-tenant auth and authorization with tenant claims.
2. Admin biller and user management with durable persistence.
3. School billing operations:
   - Student onboarding
   - Fee plan assignment
   - Invoice generation and lifecycle
   - Ledger with payment allocations
   - Defaulter and risk views
4. School payment flow:
   - BillInquiry
   - BillPayment
   - Reconciliation pipeline
5. ETEA payment controller:
   - Create payment by application
   - Status lookup
   - Callback processing
   - ETEA payment status notification
6. Audit log and operational reporting.
7. Production-grade API and network security controls aligned to 1LINK requirements.

### 7.2 Post-MVP Scope (Release 2)

1. ETEA roll assignment, admit cards, and results workflows in routed production UX.
2. Advanced retries, dead-letter handling, and reconciliation automation.
3. Enhanced analytics and scheduled exports.
4. SLA dashboard and incident runbooks.

---

## 8. Functional Requirements

### 8.1 Authentication and Access

FR-AUTH-001  
System shall authenticate users by role and tenant membership.

FR-AUTH-002  
System shall issue tokens containing role and tenant identity claims.

FR-AUTH-003  
System shall terminate user session after inactivity timeout with warning prompt.

FR-AUTH-004  
System shall deny route and API access when user role/tenant claim does not match resource scope.

### 8.2 Admin Portal

FR-ADM-001  
Admin shall create/update/suspend/ban billers.

FR-ADM-002  
System shall auto-generate unique biller codes.

FR-ADM-003  
Admin shall create users with role and optional tenant reference.

FR-ADM-004  
Admin shall ban/unban users and manage verification states.

FR-ADM-005  
Admin shall view platform transactions with search and status filtering.

FR-ADM-006  
Admin shall access API health sandbox for inquiry/payment/bundle probes.

FR-ADM-007  
Admin shall view and export audit logs.

### 8.3 School Portal

FR-SCH-001  
School users shall create, edit, import, export, and delete student records.

FR-SCH-002  
System shall generate stable consumer numbers and bill IDs per student.

FR-SCH-003  
School users shall create and manage fee plans.

FR-SCH-004  
School users shall assign payment plans by class/section and by individual student.

FR-SCH-005  
System shall prevent duplicate assignment of same plan to same consumer.

FR-SCH-006  
School users shall manage scholarships and assignment scope (student/class/section).

FR-SCH-007  
System shall compute ledger entries including:
- gross tuition
- scholarship discount
- net tuition
- bus fees
- fines
- payment allocations
- running balance

FR-SCH-008  
School users shall perform bill inquiry and payment posting through 1BILL/1LINK-compatible flow.

FR-SCH-009  
System shall reconcile successful payments by updating invoice status, ledger history, transaction log, and audit log.

FR-SCH-010  
School users shall view realtime payment feed and daily totals.

FR-SCH-011  
School users shall view defaulters, risk tiers, and send reminder actions.

FR-SCH-012  
School users shall manage school sub-users scoped to schoolRef.

FR-SCH-013  
School users shall configure billing policy (auto/manual/hybrid) and manual generation trigger.

### 8.4 ETEA Portal (Payment Controller Model)

FR-ETEA-001  
System shall treat application as payment unit (not student master ownership).

FR-ETEA-002  
ETEA user shall create payment request with applicant_id, application_id, posting_id, amount, due_date.

FR-ETEA-003  
System shall create one payment record per application and return generated bill_id.

FR-ETEA-004  
System shall provide payment status lookup by application_id.

FR-ETEA-005  
System shall process 1BILL callback and update payment state to paid/failed/expired.

FR-ETEA-006  
System shall send payment-status notification payload to ETEA endpoint contract.

FR-ETEA-007  
System shall expose health endpoint for monitoring.

FR-ETEA-008  
System shall display payment records, notifications, realtime paid feed, and posting-level reporting.

### 8.5 Shared UX and Operations

FR-UX-001  
Global search shall support key entities (students, applicants, postings, transactions).

FR-UX-002  
Notification center shall support unread/read lifecycle and clear actions.

FR-UX-003  
Exports shall be available for key tables (CSV minimum).

FR-OPS-001  
All mutating operations shall emit auditable events.

---

## 9. 1LINK / 1BILL Integration Requirements

### 9.1 Required transaction support

1. Fetch Bundle: POST /v1/Transaction/Fetchbundle (or canonical agreed endpoint variant)
2. Inquiry: POST /api/1.0/Payments/BillInquiry
3. Payment: POST /api/1.0/Payments/BillPayment

### 9.2 Inquiry requirements

- Support fixed-length constraints for username/password/consumer_number/bank_mnemonic/reserved.
- consumer_number max length must honor 1LINK constraints.
- Support reserved field packing for CNIC, account ID, bundle ID, and support info segments.
- Parse and map response_Code and bill_status values.

### 9.3 Payment requirements

- Enforce unique transaction identity tuple:
  - consumer_number
  - tran_auth_id
  - tran_date
  - tran_time
- Handle duplicate transaction responses deterministically.
- Persist gateway response and internal status mapping.

### 9.4 Response code mapping requirements

System shall map 1LINK response codes to internal business states and operator messages, including at minimum:

- 00 success
- 01 invalid/not found
- 02 blocked/unknown error (context-specific by transaction)
- 03 bad/duplicate transaction
- 04 invalid data
- 05 processing fail
- 06 already paid (where applicable)

### 9.5 Callback and notification requirements

- Callback endpoint: POST /api/payment/callback
- Upstream notification endpoint pattern: POST /api/etea/payment-status
- Enforce idempotency key and replay protection.
- Enforce signature validation and source trust checks.

---

## 10. Network and Connectivity Requirements (From 1LINK Standards)

NR-NET-001  
Integration shall support dual connectivity to 1LINK primary and DR sites.

NR-NET-002  
Transport media shall support approved wired options (P2P/MPLS/Internet with Ethernet interface).

NR-NET-003  
Routing to 1LINK external edge shall use static routing only.

NR-NET-004  
IPSec VPN configuration shall support:
- IKEv2
- AES-256 encryption
- SHA-256 hashing
- DH Group 19
- PFS enabled

NR-NET-005  
Aggressive mode shall be disabled.

NR-NET-006  
Public IP for service communication is restricted; private segments required per partner agreement.

NR-NET-007  
Wireless last-mile media types prohibited by guideline shall not be used.

---

## 11. Data Requirements

### 11.1 Core entities

- Tenant (school/etea organization)
- User
- Biller
- Student (school domain)
- Scholarship and assignment
- Fee plan and assignment
- Invoice
- Ledger entry
- Transaction
- Audit log
- ETEA payment record
- ETEA payment notification

### 11.2 ETEA payment record minimum fields

- id
- application_id
- applicant_id
- posting_id
- bill_id
- amount
- status
- due_date
- expiry_date
- created_at
- paid_at
- transaction_id
- callback_url

### 11.3 Data governance

- Every record shall carry tenant key for row-level enforcement.
- Payment and audit data shall be immutable or append-only where applicable.
- Sensitive fields (CNIC, auth values) shall be masked in UI logs and protected at rest.

---

## 12. Security and Compliance Requirements

SR-001  
All API traffic shall use HTTPS only.

SR-002  
System shall enforce API key auth for ETEA payment-controller calls.

SR-003  
System shall enforce source IP whitelist on callback and privileged routes.

SR-004  
System shall validate webhook signatures for callback authenticity.

SR-005  
System shall enforce callback idempotency and duplicate transaction detection.

SR-006  
System shall implement least-privilege RBAC and tenant isolation checks on all operations.

SR-007  
System shall provide full auditability for create/update/delete/payment-critical events.

SR-008  
System shall avoid plaintext credential leakage in logs and UI.

---

## 13. Non-Functional Requirements

### 13.1 Performance

- P95 API latency target: <= 500 ms for core read paths under nominal load.
- P95 callback processing target: <= 1 second excluding external dependencies.

### 13.2 Reliability

- Target uptime: 99.9% monthly for core payment services.
- Callback processing must be exactly-once effective at business level (idempotent semantics).

### 13.3 Scalability

- Support multi-tenant growth without cross-tenant data leakage.
- Partition indexes by tenant and date for high-volume transactions.

### 13.4 Observability

- Structured logs with correlation IDs.
- Metrics for request volume, failures, callback retries, duplicate detections.
- Alerting on scheduler/callback/integration failures.

### 13.5 Maintainability

- Contract tests for 1LINK payload/response validation.
- Automated lint/test/build gates in CI.

---

## 14. Reporting and Analytics Requirements

1. Platform-level KPIs for admin (tenants, transactions, revenue, failures).
2. School-level KPIs (collections, outstanding, defaulters, risk tiers, class analytics).
3. ETEA-level KPIs (payment requests, paid ratio, posting-level collections, verified txns).
4. Realtime payment stream views for school and ETEA.
5. Export capability for operational and compliance reports.

---

## 15. UX Requirements

1. Clear role-focused dashboards with no cross-role confusion.
2. High-signal table filtering/search on all operational lists.
3. Deterministic status badges and severity colors for financial risk.
4. Explicit workflow states for inquiry, payment, callback, and reconciliation.
5. Mobile-responsive behavior for all key pages (dashboard, payment controller, tables).

---

## 16. Testing and Quality Strategy

### 16.1 Unit tests

- Amount formatting/mapping
- Reserved field builders and parsers
- Status mapping logic
- Duplicate transaction detection
- Idempotency behavior

### 16.2 Integration tests

- Inquiry and payment contract compliance
- Callback processing end-to-end
- Reconciliation side-effects (invoice/ledger/txn/audit)
- Tenant isolation boundaries

### 16.3 E2E tests

- Role login and route protection
- School billing lifecycle
- ETEA create-lookup-callback lifecycle
- Admin user/biller operations

### 16.4 Minimum quality gate before production

- Build passes
- Lint passes
- Contract and core integration tests pass
- No critical security findings open

---

## 17. Gap-to-Target Roadmap

### Phase 0: Foundation hardening

- Introduce backend API + persistent storage.
- Replace in-memory arrays with repository/service layers.
- Add tenant keys and authorization middleware.

### Phase 1: Payments and reconciliation MVP

- Productionize inquiry/payment/callback flows.
- Implement durable idempotency store and transaction dedupe.
- Implement audit/event logging pipeline.

### Phase 2: Tenant operations and reporting

- Complete school and ETEA reporting with backend aggregates.
- Add scheduler-backed invoice generation.
- Add monitoring and alerting dashboards.

### Phase 3: Advanced ETEA workflow expansion

- Route and productionize roll assignment, admit cards, results, service list/payment programs.
- Add workflow policy controls and approvals.

---

## 18. Dependencies

1. Finalized commercials and legal onboarding with 1LINK.
2. Network provisioning (primary + DR links).
3. Security secrets and key management process.
4. Upstream ETEA source-system integration contract for reference IDs.
5. DevOps environment setup for staging/UAT/production.

---

## 19. Risks and Mitigations

1. Risk: duplicate or replayed callbacks cause financial inconsistency.
   - Mitigation: durable idempotency keys + unique constraints + audit trails.

2. Risk: tenant data leakage.
   - Mitigation: mandatory tenant claim checks and row-level policies.

3. Risk: integration payload drift versus 1LINK spec.
   - Mitigation: schema validation, contract tests, versioned adapters.

4. Risk: scheduler failures create billing gaps.
   - Mitigation: hybrid mode with manual override and proactive alerts.

5. Risk: poor test coverage causes regressions in payment-critical logic.
   - Mitigation: enforce test gates on core payment flows before deploy.

---

## 20. Acceptance Criteria (MVP Exit)

MVP is accepted when all conditions below are true:

1. Admin can onboard billers and users with tenant scoping persisted in backend.
2. School can complete full cycle: student -> plan assignment -> invoice -> inquiry -> payment -> reconciliation.
3. ETEA can complete full cycle: create payment -> lookup -> callback -> status notify.
4. Duplicate callback and duplicate payment submissions are safely idempotent.
5. All tenant-scoped reads/writes are isolated and verified by automated tests.
6. Audit logs are available for all payment-critical operations.
7. 1LINK contract tests pass for required transactions and response mappings.
8. Operational dashboards and exports are available for all three roles.

---

## 21. Open Questions

1. What is the exact production endpoint naming convention to freeze for Fetch Bundle capitalization and versioning?
2. Which fields in 1LINK reserved segments are mandatory for each billing partner type?
3. What are final SLA penalties and retry windows agreed with 1LINK/partners?
4. Which PII masking policy is required for CNIC in exports and logs?
5. Should ETEA payment notifications be push-only, pull-only, or both?
6. What is the compliance retention window for transactions and audit logs?

---

## Appendix A: Implementation Mapping Snapshot

### Routed and active in app shell

- Admin: dashboard, billers, users, transactions, cashflow, reports, audit, api-health
- School: dashboard, students, fee-plans, fee-ledger, scholarships, billing/invoices, defaulters, payments, realtime-payments, payment-programs, reports, login-activity, settings
- ETEA: dashboard, postings, applicants, invoices, payments, realtime-payments, reports, settings

### Existing but currently not routed

- ETEA Roll Assignment
- ETEA Admit Cards
- ETEA Results
- ETEA Service List
- ETEA Payment Programs

These modules should be evaluated for Phase 3 promotion.

---

## Appendix B: Canonical ETEA Payment API Contract (Target)

### Create payment

- POST /api/payments/create

Request:
- applicant_id
- application_id
- posting_id
- amount
- due_date
- description

Response:
- payment_id
- bill_id
- status
- payment
- oneBillRequest

### Get payment status

- GET /api/payments/{application_id}

Response:
- status (pending, paid, failed, expired, not_found)
- payment (if found)

### Callback

- POST /api/payment/callback

Request:
- bill_id
- status (paid, failed, expired)
- transaction_id
- paid_at

Response:
- acknowledged
- message
- payment (if matched)

### Notify source

- POST /api/etea/payment-status

Payload:
- application_id
- status

### Health

- GET /api/health

Response:
- status
- service
- timestamp
