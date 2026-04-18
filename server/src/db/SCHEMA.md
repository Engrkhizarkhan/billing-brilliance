# Payniva — Database Schema Reference

> **Single source of truth:** `server/src/db/schema.sql`  
> Run migrations with `node server/src/db/migrate.js`  
> Fresh install: `node server/src/db/migrate.js --fresh`

---

## Overview

Multi-tenant education & organization payment platform backed by **MySQL 8+**.  
All tables use `InnoDB`, `utf8mb4` charset, `utf8mb4_unicode_ci` collation.  
Primary keys are **UUID v4** strings (`VARCHAR(36)`).

---

## Table Index

| # | Table | Purpose |
|---|-------|---------|
| 1 | `tenants` | Root multi-tenant registry |
| 2 | `roles` | Named roles (platform_admin, school_admin, etc.) |
| 3 | `permissions` | Resource × action permission records |
| 4 | `role_permissions` | Many-to-many role ↔ permission |
| 5 | `users` | All platform users (admin / school / org) |
| 6 | `user_roles` | Many-to-many user ↔ role |
| 7 | `students` | School tenant students |
| 8 | `fee_heads` | Named fee components per tenant |
| 9 | `fee_plans` | Bundled fee plans (tuition or additional) |
| 10 | `scholarships` | Discount schemes |
| 11 | `student_scholarship_assignments` | Student ↔ scholarship links |
| 12 | `invoices` | Monthly/periodic invoices per student |
| 13 | `transactions` | Completed 1LINK payment events |
| 14 | `ledger_entries` | Double-entry ledger per student |
| 15 | `payments` | Duplicate-detection anchor for bill payments |
| 16 | `org_postings` | Org tenant entry-test / job postings |
| 17 | `applicants` | Applicants for org postings |
| 18 | `services` | Org application-level services |
| 19 | `org_payment_records` | Payment requests for org applicants |
| 20 | `org_payment_notifications` | Webhook delivery log for org payments |
| 21 | `callback_idempotency_log` | Idempotent callback dedup |
| 22 | `payment_plan_assignments` | Student ↔ fee plan assignments |
| 23 | `audit_logs` | Immutable audit trail |
| 24 | `notifications` | In-app notifications per user/tenant |
| 25 | `settings` | Key-value config store per tenant |
| 26 | `refresh_tokens` | JWT refresh token store |
| 27 | `bill_bundles` | Tenant-scoped 1LINK bill bundles |
| 28 | `bundles` | 1LINK FetchBundle cache per PCID |
| 29 | `bundle_pcids` | 1LINK per-PCID API keys |

---

## Table Details

### `tenants`
Root record for every biller on the platform.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) PK | UUID v4 |
| `name` | VARCHAR(255) | Display name |
| `type` | ENUM | `school` \| `org` \| `private_agency` |
| `biller_code` | VARCHAR(20) UNIQUE | 1LINK biller identifier |
| `email` | VARCHAR(255) | |
| `phone` | VARCHAR(20) | |
| `status` | ENUM | `active` \| `suspended` \| `banned` |
| `settings` | JSON | Tenant-level config blob |
| `api_key` | VARCHAR(64) UNIQUE | External integration key (1BILL, SaaS gateway) |

---

### `users`
All platform users across all tenants.

| Column | Type | Notes |
|--------|------|-------|
| `role` | ENUM | `admin` \| `school` \| `org` |
| `school_access_role` | ENUM | `admin` \| `finance` \| `staff` \| `viewer` — school sub-roles only |
| `school_ref` | VARCHAR(50) | `SCH-{biller_code}` — groups sub-users to a school |
| `main_school_user_id` | VARCHAR(36) FK→users | Parent school admin for sub-user |
| `tenant_id` | FK→tenants | NULL for platform admins |

---

### `fee_plans`
Defines recurring or one-time fee structures.

| Column | Type | Notes |
|--------|------|-------|
| `frequency` | ENUM | `monthly` \| `quarterly` \| `yearly` \| `one-time` |
| `plan_type` | ENUM | `tuition` (one per student) \| `additional` (gym, books, etc.) |
| `late_fee` | DECIMAL(10,2) | Captured at invoice generation time |

---

### `invoices`
One invoice per fee plan per student per month.

| Column | Type | Notes |
|--------|------|-------|
| `fee_plan_id` | VARCHAR(36) FK→fee_plans | Source plan |
| `late_fee` | DECIMAL(10,2) | Snapshot of plan late_fee at generation |
| `late_fee_applied` | TINYINT(1) | Guards against double-charging |

---

### `ledger_entries`
Double-entry style ledger per student.

| Column | Type | Notes |
|--------|------|-------|
| `entry_type` | ENUM | `charge` \| `payment` \| `adjustment` \| `late_fee` |

---

### `payment_plan_assignments`
Links a student to a fee plan.

| Column | Type | Notes |
|--------|------|-------|
| `assigned_via` | ENUM | `class` (bulk) \| `individual` (manual) |

---

### `org_postings`
Entry-test or job-vacancy postings managed by org tenants.

| Column | Type | Notes |
|--------|------|-------|
| `type` | ENUM | `entry_test` \| `job_vacancy` |
| `status` | ENUM | `draft` \| `active` \| `closed` |

---

### `org_payment_records`
One payment request per applicant per posting.

| Column | Type | Notes |
|--------|------|-------|
| `bill_id` | VARCHAR(100) UNIQUE | `ORG-MDCAT25-00001` format |
| `consumer_number` | VARCHAR(24) UNIQUE | 1LINK BillInquiry/BillPayment lookup key |
| `status` | ENUM | `pending` \| `paid` \| `failed` \| `expired` |
| `expiry_date` | DATETIME | Auto-expired by `expireOverduePayments` job |

---

### `bundles` + `bundle_pcids`
1LINK FetchBundle cache and PCID API-key store.  
`bundle_pcids.biller_id` optionally links a PCID to a tenant so the SaaS gateway scopes consumer queries correctly.

---

## ENUM Reference

| Table.Column | Values |
|---|---|
| `tenants.type` | `school`, `org`, `private_agency` |
| `tenants.status` | `active`, `suspended`, `banned` |
| `users.role` | `admin`, `school`, `org` |
| `users.school_access_role` | `admin`, `finance`, `staff`, `viewer` |
| `users.status` | `active`, `suspended`, `banned` |
| `students.status` | `active`, `inactive` |
| `students.gender` | `male`, `female` |
| `fee_plans.frequency` | `monthly`, `quarterly`, `yearly`, `one-time` |
| `fee_plans.plan_type` | `tuition`, `additional` |
| `invoices.status` | `pending`, `paid`, `overdue` |
| `transactions.status` | `completed`, `pending`, `failed` |
| `ledger_entries.entry_type` | `charge`, `payment`, `adjustment`, `late_fee` |
| `org_postings.type` | `entry_test`, `job_vacancy` |
| `org_postings.status` | `draft`, `active`, `closed` |
| `applicants.payment_status` | `paid`, `pending`, `partial` |
| `applicants.application_status` | `submitted`, `fee_pending`, `fee_paid`, `roll_assigned`, `test_scheduled`, `appeared`, `result_pending`, `selected`, `rejected` |
| `org_payment_records.status` | `pending`, `paid`, `failed`, `expired` |
| `org_payment_notifications.status` | `pending`, `paid`, `failed`, `expired` |
| `payment_plan_assignments.status` | `active`, `pending`, `completed` |
| `payment_plan_assignments.assigned_via` | `class`, `individual` |
| `notifications.type` | `payment`, `applicant`, `alert`, `system` |
| `bill_bundles.frequency` | `monthly`, `quarterly`, `yearly`, `one-time` |
| `bundles.status` | `active`, `inactive` |

---

## Key Relationships

```
tenants ─┬─< users
         ├─< students ──< invoices
         │              ──< ledger_entries
         │              ──< payment_plan_assignments >─ fee_plans
         │              ──< student_scholarship_assignments >─ scholarships
         ├─< fee_heads
         ├─< fee_plans
         ├─< applicants ──< org_payment_records ──< org_payment_notifications
         ├─< org_postings
         ├─< services
         ├─< transactions
         ├─< payments
         ├─< bill_bundles
         ├─< notifications
         └─< settings
```

---

## Migration History (consolidated into schema.sql)

| # | File | Change |
|---|------|--------|
| 001 | `001_initial_schema.sql` | Full initial schema |
| 002 | `002_payment_plan_assignment_metadata.sql` | Added `assigned_via` to `payment_plan_assignments` |
| 003 | `003_add_late_fee_to_invoices.sql` | Added `fee_plan_id`, `late_fee` to `invoices` |
| 004 | `004_add_api_key_to_tenants.sql` | Added `api_key` to `tenants` |
| 005 | `005_add_consumer_number_to_etea.sql` | Added `consumer_number` to `org_payment_records` |
| 006 | `006_fee_plan_type.sql` | Added `plan_type` to `fee_plans`; extended `frequency` ENUM |
| 007 | `007_late_fee_tracking.sql` | Added `late_fee_applied` to `invoices`; added `late_fee` to `ledger_entries.entry_type` |
| 008 | `008_bundles.sql` | Created `bundles` table |
| 009 | `009_bundle_pcids.sql` | Created `bundle_pcids` table |
| 010 | `010_add_biller_id_to_bundle_pcids.sql` | Added `biller_id` to `bundle_pcids` |
| 011 | `011_rename_etea_to_org.sql` | Renamed `etea_*` tables → `org_*`; updated ENUMs |

All changes from migrations 001–011 are baked into `schema.sql`.  
Individual migration files are kept in `migrations/archive/` for historical reference.
