# Payniva Fee Generation Strategy (Backend Task Guide)

This guide defines how to implement Auto, Manual, and Hybrid fee generation for school billing while keeping one lifelong consumer number per student.

## Core Meaning

- Consumer number is permanent per student and never changes.
- Invoices are periodic records (monthly/quarterly/yearly) linked to the same consumer number.
- Payments settle open invoice(s) for that consumer number.
- Due date applies per invoice cycle, not per consumer number lifecycle.

## Mode Definitions

### 1) Auto Only
- System generates invoices by scheduler (cron/job) for eligible students.
- Best for scale.
- Risk: silent scheduler failure can block invoice creation unless monitored.

### 2) Manual Only
- Staff clicks "Generate Fees" action to create invoices.
- Simple to understand.
- Risk: missed/late billing if operations team forgets or delays.

### 3) Hybrid (Recommended)
- Scheduler auto-generates invoices daily.
- Staff can run "Generate Fees Now" as override/fallback.
- Strongest operational model for reliability and control.

## Backend Tasks

## Task Group A: Data Model

- Create `student_accounts` table/model:
  - `student_id` (unique)
  - `consumer_number` (unique, immutable)
  - `status`
- Create `invoice_cycles` table/model:
  - `id`
  - `student_id`
  - `consumer_number`
  - `fee_plan_id`
  - `billing_period` (e.g., `2026-04`)
  - `issue_date`
  - `due_date`
  - `base_amount`
  - `late_fee_amount`
  - `discount_amount`
  - `total_amount`
  - `status` (`unpaid`, `partial`, `paid`, `overdue`, `void`)
- Add unique idempotency guard:
  - unique key on (`student_id`, `fee_plan_id`, `billing_period`)

## Task Group B: Scheduler (Auto Mode)

- Implement recurring job (recommended daily at off-peak hour).
- Job logic:
  - Load active student-plan assignments.
  - For each assignment, compute current due cycle.
  - If invoice for that cycle does not exist, create it.
- Add idempotency token/log for each run to avoid duplicates.
- Store run history:
  - `started_at`, `finished_at`, `status`, `generated_count`, `failed_count`, `error_summary`.

## Task Group C: Manual Generation Endpoint

- Create endpoint: `POST /billing/generation/run`.
- Request payload:
  - mode context (`manual` or `hybrid-override`)
  - optional filters (`class`, `section`, `student_ids`, `billing_period`)
- Response:
  - run id
  - generated count
  - skipped count
  - duplicate count
  - errors (if any)
- Same generation logic as scheduler (shared service), not a separate code path.

## Task Group D: Policy Configuration

- Persist billing policy per tenant/school:
  - `generation_mode` (`auto`, `manual`, `hybrid`)
  - `alert_on_scheduler_failure` (boolean)
  - `auto_apply_late_fee` (boolean)
- Expose config APIs:
  - `GET /billing/policy`
  - `PUT /billing/policy`

## Task Group E: Due Date and Late Fee Rules

- Due date derives from fee plan (`due_day`) and billing period.
- If invoice remains unpaid after due date:
  - mark as `overdue`
  - apply configured late fee logic (fixed or percentage)
- Late fee should be deterministic and auditable (write adjustment entries).

## Task Group F: Payment Allocation

- Recommended default: oldest unpaid invoice first (FIFO).
- Support optional exact-invoice payment when requested.
- Always maintain ledger references:
  - payment transaction id
  - allocated invoice id(s)
  - allocation amount per invoice

## Task Group G: Monitoring and Alerts

- Emit metrics:
  - scheduler success/failure count
  - invoice generated per run
  - missed cycle detection
  - duplicate prevention count
- Trigger alerts when:
  - scheduler run fails
  - no successful run within SLA window
  - abnormal drop in generated invoices

## Task Group H: Audit and Compliance

- Record who triggered manual generation and with what filters.
- Keep immutable audit logs for:
  - policy changes
  - invoice generation runs
  - late-fee applications
  - invoice status transitions

## Task Group I: API Contracts for Frontend

- `GET /billing/policy`
- `PUT /billing/policy`
- `GET /billing/generation/health` (last run, status)
- `POST /billing/generation/run`
- `GET /billing/generation/runs` (history)

## Task Group J: Test Cases (Must Have)

- Auto run generates one invoice per student-plan-period only.
- Re-running auto/manual for same period creates zero duplicates.
- Hybrid mode allows successful manual override.
- Due-date transition moves invoice to overdue after cutoff.
- Late fee application is correct and idempotent.
- Payment allocation updates invoice and ledger states correctly.

## Suggested Rollout Plan

1. Implement data model + idempotent generation service.
2. Integrate scheduler and run history.
3. Expose manual trigger endpoint.
4. Add policy endpoints and health endpoint.
5. Add monitoring + alerts.
6. Enable hybrid mode by default for production tenants.
