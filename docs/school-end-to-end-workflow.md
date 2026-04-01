# Payniva School Workflow (End-to-End)

This document explains the full school-side workflow in order, from onboarding students to billing, collections, and final settings. It is designed for product, frontend, backend, QA, and AI implementation alignment.

## 1. Actors and Responsibilities

- School Admin:
  - Configures fee plans and policy.
  - Approves staff access.
  - Oversees collections and reports.
- Finance Staff:
  - Manages students, invoices, payments, and reminders.
  - Tracks defaulters and reconciliation.
- Viewer/Read-only Staff:
  - Monitors dashboards and reports.

## 2. Core System Principles

- One student gets one lifelong consumer number.
- Consumer number identifies account, not one invoice.
- Every billing cycle creates a new invoice under the same consumer number.
- Ledger is the source of truth for charge/payment history.
- Invoices and payments must always be auditable.

## 3. Workflow Overview (High Level)

1. Configure fee structure (plans, due rules, late fee rules).
2. Add or import students.
3. Assign plans to classes or individual students.
4. Generate invoices (Auto, Manual, or Hybrid policy).
5. Track invoices and payment status.
6. Post and allocate payments.
7. Review ledger and defaulters.
8. Apply scholarships/discounts and adjustments.
9. Run reports and exports.
10. Manage settings, users, security, and notifications.

---

## 4. Detailed Workflow by Module

## 4.1 School Dashboard

Purpose:
- Daily operational snapshot before action.

What users see:
- Total students.
- Collections this month.
- Outstanding amount.
- Defaulters count.
- Class distribution and trend charts.

Action outcome:
- Team decides where to work next (students, invoices, defaulters, payments).

---

## 4.2 Students Module (Add and Maintain Students)

Purpose:
- Build the student billing base.

Main actions:
- Add student manually.
- Bulk import students by CSV.
- Search/filter by class, section, name, CNIC, roll number.
- Export student list.

Required fields (minimum):
- Name, Father Name, Roll Number, Class, Section, CNIC, Phone.

System behavior:
- Student record is created.
- Consumer number is assigned once and never changed.
- Student status defaults to active unless marked otherwise.

Validation rules:
- Prevent duplicate student identity based on school rules (CNIC, roll number, or both).
- Ensure required fields exist before save.

Backend expectation:
- Persist immutable consumer number and link it to student id.

---

## 4.3 Scholarships Module (Assign Discounts)

Purpose:
- Apply financial aid before or during billing cycles.

Scholarship types:
- Percentage discount.
- Fixed amount discount.
- Time-bound or lifetime scholarship.

Main actions:
- Create scholarship definition.
- Assign scholarship to student.
- Activate/deactivate assignment.

Assignment logic:
- Scholarship can be applied to tuition or configured fee components.
- On invoice generation, discount is computed and stored on invoice lines/totals.

Important behavior:
- Discount must be deterministic per billing period.
- If scholarship expires, future cycles stop applying discount.

Backend expectation:
- Keep assignment history (who assigned, when, effective dates).

---

## 4.4 Fee Structure (Fee Plans)

Purpose:
- Define how much and when students are charged.

Plan properties:
- Plan name.
- Amount.
- Frequency: monthly, quarterly, yearly.
- Due day.
- Late fee rule.

Main actions:
- Create/update fee plans.
- Keep plans versioned to avoid historical data corruption.

Operational note:
- New plan changes should affect future cycles, not rewrite old invoices.

---

## 4.5 Payment Programs (Assign Plans to Students)

Purpose:
- Map fee plans to class groups or selected students.

Main actions:
- Class-level assignment (bulk).
- Student-level assignment (override/custom).

Assignment output:
- Active assignment records with:
  - student
  - plan
  - amount/frequency
  - assignment date
  - next due date

Duplicate prevention:
- Do not create duplicate active assignment for same student-plan-period.

---

## 4.6 Billing / Invoice Generation

Purpose:
- Create invoice cycles from active assignments.

Modes:
- Auto only:
  - Scheduler generates invoices on schedule.
- Manual only:
  - Staff runs generation on button click.
- Hybrid:
  - Scheduler runs by default, button acts as fallback/override.

Per-cycle generation logic:
1. Read active student-plan assignments.
2. Determine billing period for each assignment.
3. Check if invoice already exists for that period.
4. Create invoice if missing.
5. Apply scholarship adjustments and due date.

Invoice fields:
- invoice_id, student_id, consumer_number
- billing_period, issue_date, due_date
- base_amount, discount_amount, late_fee_amount, total_amount
- status: unpaid/partial/paid/overdue

Critical rule:
- Unique key per student + plan + billing period to prevent duplicates.

---

## 4.7 Invoice List and Invoice Operations

Purpose:
- Operate on generated bills.

Main actions:
- Filter by status (pending/paid/overdue).
- Search by invoice number, student, consumer number.
- Export invoice data.

Status lifecycle:
- unpaid -> partial -> paid
- unpaid/partial -> overdue (after due date)

Late fee behavior:
- Late fee can auto-apply after due date based on policy.
- Late-fee entries must be traceable in ledger.

---

## 4.8 Payments Collection

Purpose:
- Record incoming payments and allocate correctly.

Input channels:
- Gateway payment callback.
- Counter/manual posting (if enabled).

Allocation policy (recommended):
- FIFO (oldest unpaid invoice first).
- Optionally exact invoice allocation when requested.

After payment posting:
- Invoice status updates.
- Ledger credit entry is created.
- Reference transaction id is stored.
- Receipt can be generated/sent.

## 4.8A Real-Time Payments Dashboard (Separate Screen)

Purpose:
- Give operations a live view of newly received payments.

Route:
- `/school/realtime-payments`

What it shows:
- Session live payment count.
- Collected amount today.
- Number of today transactions.
- Most recent live transaction reference.
- Live feed table of completed transactions (time, transaction id, consumer number, amount, source).

How real-time is handled:
- Payment events trigger store update after reconciliation.
- Dashboard feed updates immediately when a payment is posted.
- Optional periodic refresh keeps the live view current.

Operational use:
- Finance team can verify incoming payments instantly.
- Quick detection of payment spikes or collection slowdowns.

---

## 4.9 Fee Ledger (Student Account Statement)

Purpose:
- Show complete account history per student.

Ledger includes:
- Charges (debits).
- Payments (credits).
- Late fees and adjustments.
- Running balance.
- Reference ids (invoice/transaction).

Usage:
- Support query resolution with parents.
- Verify outstanding and payment history.
- Reconcile invoice totals with payment allocations.

---

## 4.10 Defaulters Workflow

Purpose:
- Manage unpaid/overdue students.

Main actions:
- List students with positive outstanding balance.
- Filter/search and export defaulters.
- Trigger reminders (SMS/email).

Operational use:
- Collections team follows this list daily/weekly.
- Moves students from overdue to paid as settlements occur.

---

## 4.11 Reports and Exports

Purpose:
- Provide management and operational insight.

Report groups:
- Collection trend.
- Outstanding by class.
- Defaulter aging.
- Scholarship impact.
- Payment channel mix.

Export options:
- CSV for analysis.
- Printable/PDF view for audits.

---

## 4.12 Settings (Final Stage)

Purpose:
- Configure operational and policy controls.

Settings areas:
- Fee generation policy:
  - auto/manual/hybrid.
- Scheduler and alerts:
  - alert on scheduler failure.
  - view scheduler health and last run.
- Billing behavior:
  - auto late fee on/off.
- User and access settings:
  - add staff, roles, verification, password update.
- Communication:
  - reminder channels and receipt preferences.

Expected effect:
- Settings drive future behavior and should be auditable.

---

## 5. End-to-End Example (One Student)

1. Student is added in Students module.
2. System assigns lifelong consumer number.
3. School assigns Monthly Plan via Payment Programs.
4. Invoice generation creates April invoice with due date 10th.
5. Scholarship (10%) is active, so invoice total is discounted.
6. Student pays after due date; system applies late fee if enabled.
7. Payment allocates to oldest unpaid invoice.
8. Invoice becomes paid (or partial if insufficient amount).
9. Ledger shows charge, late fee, payment entries, and new balance.
10. Reports and defaulters lists update automatically.

---

## 6. Required Backend Guarantees

- Idempotent invoice generation.
- Immutable consumer number.
- Strong audit logs for policy, generation, and payments.
- Deterministic scholarship and late-fee calculations.
- Atomic payment allocation + ledger updates.

---

## 7. QA Checklist (Functional)

- Student create/import works and prevents duplicates.
- Scholarship assignment applies correctly by effective dates.
- Fee plan assignment updates next due date correctly.
- Auto/manual/hybrid generation behaves as expected.
- No duplicate invoices for same student-plan-period.
- Due-date transitions to overdue are correct.
- Payment allocation and ledger entries always reconcile.
- Defaulters and reports reflect latest states.
- Settings changes affect future cycles and are logged.

---

## 8. Current Frontend vs Future Backend

Current frontend state:
- Many modules are mock/local-state driven.
- Session refresh may reset some changes.

Target backend state:
- Persistent tenant-aware storage.
- Real scheduler jobs and health monitoring.
- Real payment callbacks and reconciliation.
- Stable APIs for policy, generation, invoicing, ledger, and reports.
