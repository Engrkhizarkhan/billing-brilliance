# ETA Dashboard Workflow (Target Production Model)

Last updated: 2026-04-05

Related workflow docs:

- Full Workflow: [workflow.md](./workflow.md)
- Sequence View: [workflow-sequence.md](./workflow-sequence.md)

This document captures the ETA payment architecture exactly as required for production-style behavior.
The ETA dashboard should behave as a payment controller over applications, not as an owner of student master data.
Endpoint naming in this document follows the canonical callback path: `POST /api/payment/callback`.

## 1) Roles in This System

Four systems participate in one complete payment lifecycle:

1. ETEA System (source of applicants and applications)
2. Your Payment System (middleware and payment engine)
3. 1Bill (payment aggregator)
4. Student or Applicant (payer)

Request and callback chain:

ETEA -> Your System -> 1Bill -> Bank or Wallet -> Callback -> Your System -> ETEA

## 2) Core Rule: No Permanent Students in Payment Engine

Because ETEA owns applicant and application master data:

- Do store temporary payment records.
- Do not create permanent student entities in payment engine domain.

Design principle:

- Person is not the payment unit.
- Application is the payment unit.

So each application gets exactly one payment record for its payment request.

## 3) Bill ID Strategy

Use one unique bill ID per payment request (per application).

Do not use one fixed bill ID per person.

Reason:

- One person can submit multiple applications across postings.
- Every application requires independent payment tracking.

Valid examples:

- ETEA-2026-POST-12345
- PAY-APP-987654

Each bill ID maps to:

- one application
- one payment record
- one status timeline

## 4) Production Flow Standard

### Step 1: ETEA creates payment request

Endpoint:

- POST /api/payments/create

Request fields:

- applicant_id
- application_id
- posting_id
- amount
- due_date
- description

Example request:

```json
{
  "applicant_id": "STU-9981",
  "application_id": "APP-44521",
  "posting_id": "LECTURER-2026",
  "amount": 1200,
  "due_date": "2026-04-10"
}
```

### Step 2: payment system creates payment record

System generates:

- payment_id
- bill_id
- status = pending

Example record:

```json
{
  "payment_id": "PAY-1001",
  "application_id": "APP-44521",
  "amount": 1200,
  "bill_id": "ETEA-1001",
  "status": "pending"
}
```

### Step 3: payment system calls 1Bill create bill API

Example payload:

```json
{
  "bill_id": "ETEA-1001",
  "amount": 1200,
  "due_date": "2026-04-10",
  "customer_name": "Ali Khan",
  "callback_url": "/api/payment/callback"
}
```

### Step 4: student pays using bill ID

Payment channels include:

- Easypaisa
- JazzCash
- Bank
- ATM
- Mobile banking

### Step 5: 1Bill callback to payment system

Endpoint:

- POST /api/payment/callback

Example callback:

```json
{
  "bill_id": "ETEA-1001",
  "status": "paid",
  "transaction_id": "TXN-88291",
  "paid_at": "2026-04-03"
}
```

### Step 6: payment system updates payment status

Payment status becomes paid, failed, or expired.

### Step 7: payment system notifies ETEA

Endpoint pattern:

- POST /api/etea/payment-status

Example notification:

```json
{
  "application_id": "APP-44521",
  "status": "paid"
}
```

## 5) Ownership Boundary

ETEA should not add students into payment system scope.

Payment system stores only temporary payment transaction records.

## 6) Minimal Database Model

payments table:

- id
- application_id
- applicant_id
- posting_id
- bill_id
- amount
- status
- due_date
- created_at
- paid_at

Valid statuses:

- pending
- paid
- failed
- expired

## 7) Required API Endpoints

Only these are required for the payment controller core:

1. POST /api/payments/create (called by ETEA)
2. GET /api/payments/{application_id} (called by ETEA)
3. POST /api/payment/callback (called by 1Bill)
4. GET /api/health (monitoring)

## 8) Multiple Applications per Person

This is handled by design rule:

One application equals one payment.

Example:

- APP-1001 -> Lecturer -> Payment 1200
- APP-1002 -> Assistant Professor -> Payment 1500
- APP-1003 -> Entry Test -> Payment 800

Each application gets its own bill_id.

## 9) Expiry Requirement

Payments should expire automatically (for example after 48 hours).

After expiry:

- status = expired

## 10) Security Requirements (Mandatory)

For government-grade reliability:

- API key authentication
- IP whitelisting
- HTTPS only
- Webhook signature verification
- Idempotency protection

## 11) Recommended Production Architecture

ETEA
-> Load Balancer
-> Payment API (your system)
-> Database
-> 1Bill API
-> Callback Webhook

## 12) Real Example

Medical test applicant flow:

1. ETEA requests create payment.
2. Payment system generates bill_id (for example ETEA-98231).
3. Applicant pays using that bill ID.
4. 1Bill callback updates payment status.
5. Payment system notifies ETEA with final status.

## 13) ETA Dashboard Behavior Mapping

Dashboard modules should align with this architecture:

- Postings page: source list for posting_id and amount defaults.
- Applicants page: ETEA-side references, payment trigger point, no student master ownership.
- Payments page: create, status lookup, callback, and health operations.
- Realtime payments page: paid events only from payment records.
- Reports page: payment analytics from payment records and synced transactions.
- Settings page: API key, source IP, HTTPS policy, signature verification, idempotency policy visibility.

## 14) Current Mock Frontend Note

This repository is frontend-only and in-memory.

- It demonstrates production API behavior and lifecycle logic.
- It does not persist records after browser reload.
