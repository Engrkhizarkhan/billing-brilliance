# Billing Brilliance Full Workflow

Last updated: 2026-04-05

Related workflow docs:

- ETEA Dashboard Workflow: [etea-dashboard-workflow.md](./etea-dashboard-workflow.md)
- Sequence View: [workflow-sequence.md](./workflow-sequence.md)

ETEA canonical endpoints in this document:

- `POST /api/payments/create`
- `GET /api/payments/{application_id}`
- `POST /api/payment/callback`
- `POST /api/etea/payment-status`
- `GET /api/health`

## 1. Purpose

This document provides a complete, implementation-accurate workflow for the current system, including:

- Admin lifecycle: login, biller setup, user management, platform monitoring.
- School lifecycle: student onboarding, scholarship/plan assignment, invoices, ledger, payments, defaulters, settings.
- ETEA lifecycle: posting and application-reference handling, payment request/callback flow, realtime tracking, reporting.
- 1Bill and 1Link API behavior in this codebase.

This repository is frontend-first with in-memory/mock service orchestration.

## 2. System Topology

### 2.1 Portals

- Admin portal: multi-tenant control plane.
- School portal: fee and student operations.
- ETEA portal: posting and applicant payment operations.

### 2.2 SaaS Tenant Model and Data Isolation

- This platform is a SaaS multi-tenant system for schools and ETEA organizations.
- Tenant examples: School A, School B, ETEA Org A, ETEA Org B.
- Every authenticated tenant user is bound to one tenant scope.
- Strict rule: School A users cannot view or modify School B data.
- Strict rule: School B users cannot view or modify School A data.
- Strict rule: ETEA Org A users cannot view or modify ETEA Org B data, and vice versa.
- Cross-tenant access is denied by default unless user role is platform admin.
- Required enforcement: every API read/write applies tenant filter (for example school_id or organization_id).
- Required enforcement: token claims carry tenant identity and role, and ownership is validated on every mutation.
- Required enforcement: reports, exports, and audit logs stay tenant-scoped unless platform admin role is used.
- Current repository note: this frontend mock demonstrates role workflows; production backend must enforce row-level tenant isolation.

### 2.3 Core Runtime Layers

- UI and routing: React + React Router.
- Auth/session state: Zustand (`authStore`).
- Shared payment refresh signal: Zustand (`paymentStore.version`).
- ETEA security context: Zustand + localStorage (`eteaSecurityStore`).
- Domain data and service simulation: `src/data/mockData.ts`, `src/lib/mockApi.ts`, `src/services/*`.

### 2.4 ETEA Ownership Boundary (Payment Processor Mode)

- ETEA should NOT add students into the payment system as a permanent master-data owner.
- Student/applicant ownership remains with the source authority (ETEA source system).
- This system is the payment processor.
- This system should store temporary payment records only.
- Payment record scope is per application/payment request (not student master profile ownership).
- Required production behavior: process payment create/status/callback and return status to source system.
- Current demo note: local mock applicant entries are UI test fixtures, not production ownership semantics.

## 3. Authentication and Routing Workflow

### 3.1 Login

User opens `/login`, selects role, enters credentials, and submits.

Role credentials validated by `mockApi.login(email, password, role)`:

- Admin: `admin@example.com` / `123456`
- School: `school@example.com` / `123456`
- ETEA: `etea@example.com` / `123456`

On success:

1. `authStore.user` is set.
2. `authStore.isAuthenticated = true`.
3. User is redirected to `/{role}`.

On failure:

- Login toast: `Invalid credentials`.

### 3.2 Session Timeout

`useSessionTimeout` enforces inactivity controls globally in `DashboardLayout`:

- Warning at 25 minutes.
- Auto logout at 30 minutes.
- Any activity resets timer.

### 3.3 Route Guard

Every dashboard route checks for authenticated user. If missing:

- Redirect to `/login`.

### 3.4 Current Route Map

#### Admin

- `/admin`
- `/admin/billers`
- `/admin/users`
- `/admin/transactions`
- `/admin/cashflow`
- `/admin/reports`
- `/admin/audit`
- `/admin/api-health`

#### School

- `/school`
- `/school/students`
- `/school/fee-plans`
- `/school/fee-ledger`
- `/school/scholarships`
- `/school/billing` and `/school/invoices`
- `/school/defaulters`
- `/school/payments`
- `/school/realtime-payments`
- `/school/payment-programs`
- `/school/reports`
- `/school/login-activity`
- `/school/settings`

#### ETEA

- `/etea`
- `/etea/postings`
- `/etea/applicants`
- `/etea/invoices`
- `/etea/payments`
- `/etea/realtime-payments`
- `/etea/reports`
- `/etea/settings`

## 4. Admin Workflow (End-to-End)

### Step A1: Admin Login

1. Login as admin.
2. Redirect to `/admin`.
3. Dashboard loads tenant and platform overview cards/charts.

### Step A2: Create or Update Biller

At `/admin/billers`:

1. Click `Create New Biller`.
2. Enter name, type, email, phone.
3. `mockApi.createBiller()` creates biller with auto-incremented `billerCode`.
4. Biller appears in table immediately.

Additional admin actions:

- Edit biller profile via dialog.
- Suspend, ban, or re-activate via `mockApi.updateBillerStatus()`.

### Step A3: Create and Manage Users

At `/admin/users`:

1. Click `Add User`.
2. Provide name/email/role, optional password, optional school reference for school role.
3. `mockApi.createUser()` creates user and returns a generated default password if needed.
4. User appears in table with role and status.

Additional actions:

- Bulk import (simulated) creates sample users.
- Ban/unban user via `mockApi.updateUserStatus()`.

### Step A4: Platform Transaction Monitoring

At `/admin/transactions`:

- Filter and search all transactions by status, transaction ID, and consumer number.

### Step A5: API Health Sandbox

At `/admin/api-health`:

- `Run Inquiry` calls `billInquiry()`.
- `Run Payment` calls `billPayment()`.
- `Run FetchBundle` calls `fetchBundle()`.

This screen is used to verify payment API behavior in mock or live mode depending on env flags.

### Step A6: Audit Trail

At `/admin/audit`:

- View all audit log records.
- Export logs.
- Payment reconciliation also appends payment audit entries.

## 5. School Workflow (End-to-End)

### Step S1: School Login and Dashboard Triage

1. Login as school user.
2. Land on `/school` dashboard.
3. Review key metrics: student count, collection snapshot, outstanding amount, defaulters, latest-day payments.
4. Navigate to target module (students, defaulters, payments, etc.).

### Step S2: Add/Import Students

At `/school/students`:

- Add single student via form, or bulk import simulated entries.
- Each student gets:
  - Consumer number using `generateConsumerNumber('1001', studentIndex)`.
  - Bill ID like `SCH-GHS-00001`.
- Edit and delete supported.
- Row click opens student ledger.

Consumer number format:

`123456` + biller code + 14-digit padded sequence.

### Step S3: Manage Scholarships

At `/school/scholarships`:

- Create scholarship definitions (percentage/fixed, date range, lifetime option).
- Assign scholarship by student or by class/section.
- Deactivate scholarships and unassign records.

Scholarship discounts are applied during ledger generation for matching months.

### Step S4: Define Fee Plans

At `/school/fee-plans`:

- Create recurring plans (monthly/quarterly/yearly, due day, late fee).
- Plans are later assigned through payment programs.

### Step S5: Assign Payment Programs

At `/school/payment-programs`:

- Assign plan to entire classes, or specific students.
- Duplicate assignment prevention for same consumer + plan.
- Track assignment state, frequency, and due date.

### Step S6: Review Invoices

At `/school/billing` or `/school/invoices`:

- View invoice table (pending/paid/overdue).
- Search/filter by class, student, invoice number, consumer number.

### Step S7: Track Student Ledger and Financial Risk

At `/school/fee-ledger`:

- Select student and month.
- Ledger displays:
  - Tuition gross.
  - Scholarship discount.
  - Tuition net.
  - Bus fee.
  - Other charges/late fine.
  - Payments and running balance.
- Supports bus service enable/disable with monthly fee updates.

Ledger and risk snapshot are generated from current state, including runtime posted payments.

### Step S8: Bill Inquiry to Payment Posting

At `/school/payments`:

1. Enter consumer number (plus optional student ref/voucher).
2. Click `Run BillInquiry`.
3. System calls `onebillService.billInquiry()`.
4. If found, screen shows bill details + printable `FeeSlip` with QR payload.
5. Select payment channel and optional note.
6. Click `Mark Paid via 1BILL`.
7. `onebillService.billPayment()` returns payment result.
8. `reconcileBillPayment()` applies side effects:
   - mark invoice paid,
   - record runtime payment entry,
   - append transaction,
   - append audit log,
   - bump payment store version.

### Step S9: Real-Time Payment Monitoring

At `/school/realtime-payments`:

- Live feed of completed transactions.
- Session live counters and today's collection metrics.
- Auto-refresh toggle.

### Step S10: Defaulter Operations

At `/school/defaulters`:

- Lists active students with due > 0.
- Risk filters (watch/high-risk/critical).
- Export list and send reminder actions (simulated).

### Step S11: School Settings and Sub-User Management

At `/school/settings`:

- Manage school sub-users (`createSchoolSubUser`, `updateSchoolUser`, `deleteSchoolUser`, verification).
- Update main school admin password (`updateUserPassword`).
- Configure mock billing policy controls:
  - generation mode (auto/manual/hybrid),
  - scheduler alert toggle,
  - late-fee toggle,
  - manual generation run trigger.

### Step S12: Login Activity

At `/school/login-activity`:

- Filterable mock login event table by role, user, IP, device.

## 6. ETEA Workflow (End-to-End)

### Step E1: Manage Postings

At `/etea/postings`:

- Create, edit, clone postings (entry test/job vacancy).
- Posting data updates shared `eteaPostings` and notifies payment store.

### Step E2: Capture Application References (No Student Ownership)

At `/etea/applicants`:

1. Source system provides reference fields (`applicant_id`, `application_id`, `posting_id`) to payment controller.
2. Payment system does not create student master entities.
3. Payment system only uses these references to create and track temporary payment records.

### Step E3: Create ETEA Payment Request

At `/etea/payments` (`POST /api/payments/create` section):

1. Submit: `applicant_id`, `application_id`, `posting_id`, `amount`, `due_date`, `description`.
3. Call `createPayment(request, securityContext)`.
4. System returns:
   - `paymentId`,
   - generated `billId` (for example `ETEA-1001`),
   - current status,
   - payment record,
   - `oneBillRequest` payload for 1Bill Create Bill.

### Step E4: Lookup Payment Status

At `/etea/payments` (`GET /api/payments/{application_id}` section):

- Call `getPaymentStatus(applicationId, securityContext)`.
- Returns `not_found` or current payment record/status.

### Step E5: Process Callback

At `/etea/payments` (`POST /api/payment/callback` section):

1. Fill `bill_id`, callback status, transaction ID, paid timestamp.
2. UI generates webhook signature and idempotency key.
3. Call `processPaymentCallback(callback, securityContext)`.
4. On success:
   - payment record updated,
   - payment status updated (`pending` -> `paid|failed|expired`),
   - ETEA transaction upserted in global transactions,
   - ETEA payment-status notification record stored,
   - payment store bump triggers all dependent screens.

### Step E6: Health Check

At `/etea/payments` (`GET /api/health` section):

- Call `healthCheck()` and display service status/timestamp.

### Step E7: ETEA Realtime, Invoices, Reports, Settings

- `/etea/realtime-payments`: paid ETEA payment events stream with live metrics.
- `/etea/invoices`: invoice rows projected from payment records.
- `/etea/reports`: monthly collection, paid-app ratios, posting revenue table.
- `/etea/settings`: update password (mock) and API security context (API key + source IP persisted in localStorage-backed store).

## 7. ETEA Payment API Contract (As Implemented)

### 7.1 `POST /api/payments/create`

Request fields:

- `applicant_id`
- `application_id`
- `posting_id`
- `amount`
- `due_date`
- `description?`

Response:

- `paymentId`
- `billId`
- `status`
- `payment`
- `oneBillRequest`

### 7.2 `GET /api/payments/{application_id}`

Response:

- `status: pending|paid|failed|expired|not_found`
- `payment` when found.

### 7.3 `POST /api/payment/callback`

Request fields:

- `bill_id`
- `status: paid|failed|expired`
- `transaction_id`
- `paid_at?`

Response:

- `acknowledged`
- `payment?`
- `message`

### 7.4 `POST /api/etea/payment-status`

Notification payload sent by payment processor:

- `application_id`
- `status`

### 7.5 `GET /api/health`

Response:

- `status: ok`
- `service: etea-payment-controller`
- `timestamp`

## 8. ETEA Callback Security Model

Implemented checks in `eteaPaymentController.assertSecurity()`:

- HTTPS-only (`protocol` must be `https`).
- API key match (`VITE_ETEA_API_KEY`).
- Source IP must be whitelisted (`VITE_ETEA_ALLOWED_IPS`).
- Webhook signature verification (enabled unless explicitly disabled).
- Idempotency key caching to prevent duplicate callback processing.
- Duplicate `transactionId` protection across different bills.

## 9. OneBill and 1Link Workflow

### 9.1 Configuration

`onebillService` uses:

- `VITE_ONEBILL_BASE_URL` (default sandbox URL),
- `VITE_ONEBILL_USE_MOCK` (default true),
- `VITE_ONEBILL_TIMEOUT_MS`,
- OneLink credentials and bank mnemonic envs.

### 9.2 School Usage

School payments page directly uses:

- `billInquiry()`
- `billPayment()`

and then reconciliation pipeline updates invoices, transactions, ledger-derived history, and audit entries.

### 9.3 ETEA Usage

ETEA does not directly perform generic school bill inquiry/payment for application flow.

Instead it:

1. creates bill intent via `createPayment()`,
2. receives callback through `processPaymentCallback()`.

### 9.4 OneLink Reserved Field Builder

`buildOneLinkInquiryReserved()` packs CNIC/account/bundle/supporting fields into fixed-width reserved payload format for inquiry calls.

## 10. Shared Data Mutation and Refresh Workflow

Key runtime arrays:

- `students`, `invoices`, `transactions`, `auditLogs`
- `applicants`, `eteaPostings` (mock reference cache for ETEA flow)
- `runtimeBillPayments`
- `eteaPaymentRecords`, `eteaPaymentNotifications`

Key mutation trigger:

- `notifyPaymentUpdate()` increments `paymentStore.version`, causing dependent pages to recompute and refresh.

This is the cross-module synchronization mechanism in the current frontend-only architecture.

## 11. Full Operational Scenarios

### Scenario A: Admin Onboards New School Tenant

1. Admin logs in.
2. Creates biller in `/admin/billers`.
3. Creates school user in `/admin/users` with school role.
4. School user logs in and gets scoped school reference context.

### Scenario B: School Bills and Collects Payment

1. School adds/imports students.
2. Creates scholarship and fee plans.
3. Assigns plans via payment programs.
4. Reviews invoice and ledger state.
5. Runs BillInquiry.
6. Posts payment via 1BILL action.
7. Reconciliation updates invoice, transactions, audit, and realtime feed.

### Scenario C: ETEA Applicant Payment Lifecycle

1. ETEA creates posting.
2. ETEA source provides applicant/application reference (no student master ownership transfer).
3. ETEA creates payment request for application.
4. System returns OneBill create-bill payload.
5. Callback arrives with status and transaction ID.
6. System validates security, applies idempotency, updates applicant/payment state.
7. ETEA realtime/report/invoice screens reflect new status.

### Scenario D: Tenant Isolation Guarantee (School and ETEA)

1. School A user logs in and requests students, invoices, payments, and reports.
2. System applies School A tenant scope to all reads and writes.
3. School B records are excluded from School A responses.
4. Any direct access attempt to School B resource IDs is rejected (forbidden/not found by policy).
5. ETEA organizations follow the same rule: Org A cannot access Org B records.
6. Platform admin can access cross-tenant views for operations and governance.

## 12. Current Limitations

- Most runtime state is in-memory and session-scoped.
- Refresh can reset non-persisted mutations.
- Billing policy scheduler controls are UI/mock behavior, not real backend cron.
- OneBill defaults to mock mode unless env enables live integration.
- ETEA notification list is maintained in local runtime arrays (no external ETEA push transport implemented).
- Tenant partitioning is documented as required SaaS behavior, but this frontend mock is not a full production-grade row-level security backend.

## 13. Key Implementation Files

- Routing and shell: `src/App.tsx`, `src/components/DashboardLayout.tsx`
- Auth and session: `src/store/authStore.ts`, `src/hooks/useSessionTimeout.ts`
- Mock API facade: `src/lib/mockApi.ts`
- Data and generators: `src/data/mockData.ts`
- OneBill integration layer: `src/services/onebillService.ts`
- School payment reconciliation: `src/services/paymentReconciliation.ts`
- ETEA payment controller: `src/services/eteaPaymentController.ts`
- ETEA finance utilities: `src/lib/eteaFinance.ts`
- Shared payment update store: `src/store/paymentStore.ts`
- ETEA security context store: `src/store/eteaSecurityStore.ts`
