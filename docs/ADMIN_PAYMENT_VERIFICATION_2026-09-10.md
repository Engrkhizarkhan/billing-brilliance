# Admin payment verification

Prepared: 10 September 2026

## Outcome

Platform administrators now have a dedicated **Verify Payment** page at `/admin/verify-payment`.

The administrator enters a complete consumer number and receives the result in two synchronized representations:

1. a readable consumer card containing payer, biller, bill/application identifiers, dates, status, base amount, late fee, and exact payable amount;
2. the exact 1BILL-style JSON response, including `response_Code`, `consumer_detail`, `bill_status`, due date, fixed-width amounts, billing month, payment date, authorization ID, and reserved field.

The lookup supports both school consumers and organization payment requests. Missing, blocked, suspended, expired, testing-only in production, and already-paid states cannot be posted.

## Why this is not a “mark paid” switch

A paid status without financial evidence would make cash reports, payment history, reconciliation, ledger balances, and audit history disagree. The admin action therefore uses the same canonical posting service as the other payment channels.

A successful admin verification atomically creates or updates:

- the posted payment;
- completed transaction;
- invoice or organization-payment allocation;
- student ledger credit where applicable;
- invoice/request paid state;
- immutable audit entry;
- receipt number;
- notification;
- durable outbox event.

The form requires received time, channel, unique receipt/bank reference, verification reason, and the exact consumer number as confirmation. The amount is read-only and must match the calculated payable amount.

## Security and authorization

- Inquiry is restricted to authenticated platform administrators.
- Posting requires an explicit tenant scope resolved from the inquiry.
- The server independently reloads the tenant and bill inside the posting transaction.
- Suspended billers are rejected.
- Testing-stage billers are rejected when the runtime is production.
- Duplicate references and idempotency keys are rejected.
- Existing external/1BILL payments cannot be silently overwritten.

## API

### Admin consumer inquiry

`POST /api/manual-payments/inquiry`

```json
{
  "consumerNumber": "105172100100000000000003"
}
```

The response contains `data.oneBillResponse` with the gateway-compatible representation and card fields alongside it.

### Record verified payment

`POST /api/manual-payments/record`

The frontend sends the tenant in `X-Tenant-Id` and the unique replay guard in `X-Idempotency-Key`. The server does not trust amounts or status supplied by a previous lookup; it locks and validates current database state again.

## Verification evidence

- Frontend production build: passed.
- TypeScript: passed.
- Backend lint and 24 unit tests: passed.
- Authenticated MySQL integration tests: 7/7 passed.
- Browser E2E: passed in Chromium.
- Visual screenshot: `test-results/admin-payment-verification.png` during the local run (generated output is intentionally gitignored).
- Disposable posting test verified one payment, allocation, transaction, ledger entry, audit entry, and outbox event, then confirmed the refreshed 1BILL response changed to paid.
- The browser test confirms the posting button remains disabled until confirmation/evidence fields are completed; it does not execute a financial action through the UI.

## Deployment note

Deploy the frontend and backend together because the new page depends on the new inquiry endpoint and tenant-scoped manual-payment header. Apply the existing production migration/runbook gates before deployment. No VPN, Nginx, certificate, or 1LINK network configuration changes are required for this feature.
