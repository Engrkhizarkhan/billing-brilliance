# Billing Brilliance – SaaS Tenant Workflow

This document narrates the end-to-end mock workflow for the multi-tenant (school/ETA) billing platform. It reflects the current frontend behavior (Vite/React + mockApi) and how navigation/actions behave in the UI.

## Roles and Entry Points
- **Admin (owner of SaaS)**: Manages tenants (billers), users, platform health. Enters via `/login` choosing role **admin** (credentials: `admin@example.com / 123456`). Redirects to `/admin` on success.
- **School tenant users**: Manage students, billing, payments. Login with role **school** (`school@example.com / 123456`) → `/school`.
- **ETA tenant users**: Manage applicants and test workflows. Login with role **eta` (`eta@example.com / 123456`) → `/eta`.

## Admin Portal (`/admin`)
### Navigation
Sidebar groups: Dashboard, Billers, Users, Transactions, Cash Flow, Reports, Audit Trail, API Health.

### Dashboard
- Shows platform-level stats (tenants, students, invoices, revenue, payments, overdue) and tenant health table.
- Tenant health table columns: Tenant name, type, code, students, invoices, transactions, paid revenue, status.
- Charts: Monthly revenue (area), Payment success (bar), Transaction volume (line).
- Recent transactions table: transaction ID, consumer number, biller, amount, status, date.

### Biller Management (`/admin/billers`)
- Fetches tenants via mockApi; session-only.
- Filters: search by name/code; dropdowns for status (active/suspended/banned) and type (school/eta/private agency).
- Table columns: name, type, code, email, phone, created date, status, actions.
- **Create New Biller** dialog:
  - Fields: Organization Name, Type (school/eta/private agency), Email, Phone.
  - On save: mockApi `createBiller` auto-generates billerCode (increments), status `active`, created date today; updates table and toasts success.
- Actions per row:
  - View/Edit (placeholders), Suspend, Ban, Activate (if not active). Calls mockApi `updateBillerStatus` and updates row.

### User Management (`/admin/users`)
- Fetches users via mockApi; session-only.
- Filters: search, role (admin/school/eta), status (active/banned).
- Table columns: name, email, role, status, actions.
- **Add User** dialog:
  - Fields: Name, Email, Role.
  - On save: mockApi `createUser` returns user + generated default password (`ChangeMe!123-xx`); table updates; toast shows default password.
- **Bulk Import** dialog:
  - Upload placeholder, CSV template download, or simulate 3-user import (creates via mockApi `createUser`).
- Actions per row:
  - Ban (sets status banned via mockApi `updateUserStatus`).
  - Unban (when banned; sets status active via mockApi `updateUserStatus`).

### Transactions (`/admin/transactions`)
- Lists mock transactions with filters (status search) and table (txn id, biller, consumer number, amount, status, date).

### Cash Flow / Reports / Audit Trail / API Health
- Stubs: show placeholder or mock cards; Audit Trail lists mock audit logs from `mockData`.

## School Portal (`/school`)
### Navigation
Dashboard, Students, Fee Structure, Fee Ledger, Billing/Invoices, Scholarships, Defaulters, Payment Programs, Payments, Real-Time Payments, Reports, Settings.

### Key Flows
- **Students**: Table with search, class filter, pagination. Add student dialog, bulk import (simulated), export CSV. Uses mock students.
- **Fee Plans**: Shows predefined plans; add plan dialog (mock only).
- **Payment Programs**: Assign plans to classes/students (local state only).
- **Fee Ledger**: Choose student dropdown → ledger cards (totals), entries with charges/payments/late fees. Uses `generateLedger` over mock data + runtime payments.
- **Invoices (Billing)**: Table of invoices with status/search filters.
- **Scholarships**: Lists scholarships from mock data.
- **Defaulters**: Lists students with balance > 0; search/export.
- **Payments**: Bill inquiry + payment posting flow.
- **Real-Time Payments**: Dedicated live dashboard with latest completed transactions and live counters.
- **Reports (stub)**: Placeholder cards.
- **Settings**: Mock controls for billing defaults, notifications, receipts, security (non-persistent).

## ETA Portal (`/eta`)
### Navigation
Dashboard, Postings, Applicants, Roll Assignment, Admit Cards, Payment Programs, Invoices, Payments, Results, Reports, Settings.

### Key Flows
- **Dashboard**: Stats for postings/applicants/payments; charts.
- **Postings**: Lists exam/job postings (mock data).
- **Applicants**: Table with search/status/posting filters; add applicant dialog (validates duplicate CNIC per posting). Uses mock applicants; create calls `generateConsumerNumber`.
- **Roll Assignment**: Assign roll/slot/center, send admit card (mock), stage filters.
- **Admit Cards**: List applicants with roll; search; send/print actions (mock delivery channel selection).
- **Results**: List appeared candidates with marks; toggle publish; upload placeholder; publish and SMS toggles (mock only).
- **Invoices/Payments (ETA)**: Stub tables based on shared invoices/payments mock data.
- **Settings**: Mock toggles for payments, admit card policies, result publication.

## Auth & Session
- Login page pre-fills email by role; uses Zustand `useAuthStore` to validate against mock credentials; on success, navigates to `/{role}` and shows toast.
- `DashboardLayout` enforces auth; redirects to `/login` if no user. Includes session-timeout warning dialog, dark mode toggle, notifications, and grouped nav.

## Data & Mock API
- All data is in-memory mock (`src/data/mockData.ts`) with helper generators for consumer numbers, ledgers, invoices, payments, scholarships, applicants.
- `src/lib/mockApi.ts` exposes fetch/create/update endpoints for students, applicants, invoices, payments, billers, users, fee plans, bundles; simulates latency and returns deep-cloned responses.
- Runtime payment postings and bill status changes persist for the session only.

## Exports/Print
- `ExportButton` allows CSV, print, and PDF (via window.print) on supported tables.

## Notes
- All changes are session-only; refresh resets state.
- Validation is light (required fields, duplicate CNIC in applicant create); no real backend.
- Navigation items without routes were wired or stubbed; current nav paths resolve.
