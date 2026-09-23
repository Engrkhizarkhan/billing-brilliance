# Webhook contract — schema version 1

Current implementation: `server/src/workers/outboxWorker.js` and `orgPaymentController.js`. Provider-specific 1LINK inquiry/payment routes are separate from the generic organization callback below. A historical callback example is not evidence that a provider has approved that route.

## Outbound notifications

Configure the tenant's `notification_url` and webhook secret through the authorized settings flow. Destinations must use public HTTPS on port 443, without embedded credentials. Private/local destinations and redirects are rejected. Delivery pins the DNS addresses that passed validation to the actual TLS connection.

The transaction that posts or reverses a payment also stores its outbox event. A separate worker sends:

```json
{
  "schema_version": 1,
  "event_id": "<stable-event-uuid>",
  "event_type": "payment.posted",
  "created_at": "2026-09-23 10:00:00",
  "data": {
    "paymentId": "<payment-uuid>",
    "consumerNumber": "<consumer-number>",
    "amount": 1000,
    "currency": "PKR",
    "source": "org_callback",
    "reference": "<verified-reference>",
    "transactionId": "<provider-reference>",
    "receivedAt": "2026-09-23 10:00:00",
    "targetType": "org_payment",
    "applicationId": "<application-id>",
    "billId": "<bill-id>",
    "targetId": "<request-uuid>"
  }
}
```

All timestamps without an offset are UTC. School postings use `targetType: invoice`; applicationId is null. Consumers must tolerate additive fields and historical stored events without newer optional fields. `payment.reversed` data includes the original paymentId, reversalPaymentId, consumerNumber, amount, reference and reason. Use event_type to select the payload interpretation.

Headers: `Content-Type: application/json`, `X-Fintap-Event-Id`, and `X-Webhook-Signature`. The signature is lowercase hex HMAC-SHA256 of the **exact raw UTF-8 request body**, using the tenant webhook secret (or configured server fallback). Verify against raw bytes before parsing, using constant-time comparison.

A 2xx response acknowledges delivery. Other statuses, including redirects, fail. The timeout is eight seconds. Delivery is **at least once**: deduplicate by event_id and commit your own business update before acknowledging. A lost acknowledgement may cause another delivery.

Defaults: poll every two seconds, maximum ten attempts, exponential retry delay starting at 30 seconds, capped at one hour. `OUTBOX_POLL_MS` and `OUTBOX_MAX_ATTEMPTS` are server settings. Interrupted processing can be reclaimed after two minutes. Suspended tenants are deferred through failed attempts. Events without a notification URL are explicitly `skipped`, not delivered; configuring a URL later does not replay those events automatically.

Operational queries:

```sql
SELECT status, COUNT(*) FROM outbox_events GROUP BY status;
SELECT id, tenant_id, attempts, last_error, available_at
FROM outbox_events WHERE status IN ('failed','processing','skipped') ORDER BY created_at;
SELECT name, heartbeat_at FROM worker_health;
```

Terminal failures and skipped events need operator review. After correcting the cause, an operator can replay specific verified event IDs by returning those rows to pending and resetting attempts. Never delete accounting evidence or bulk-replay unreviewed events. The stable event ID must be retained for receiver deduplication.

## Inbound organization callback

`POST /api/payment/callback` requires tenant authentication (`X-API-Key` for server integrations), the source-IP allowlist, HTTPS when configured, and a valid `X-Webhook-Signature`. Dashboard JWT access does **not** remove the callback signature requirement. Production startup requires signature enforcement. Do not distribute the server callback secret to dashboard users.

```json
{"billId":"<bill-id>","status":"paid","transactionId":"<verified-provider-reference>","paidAt":"2026-09-23T10:00:00.000Z"}
```

Compute this signature with `ORG_WEBHOOK_SECRET`: lowercase hex HMAC-SHA256 of the canonical string `billId|status|transactionId|paidAt`, using the exact submitted values (empty string for an absent paidAt). This is intentionally different from the outbound raw-body signature. Supply a stable `X-Idempotency-Key` for retries. Supported status values are paid, failed and expired. A paid callback uses the stored bill amount; this adapter is only appropriate for a verified upstream contract that confirms full payment of that bill.

The canonical posting transaction enforces activation, amount, payable state and duplicate references. A paid record cannot be overwritten by failure/expiry. Duplicate already-paid callbacks are acknowledged; competing concurrent attempts may return 409, requiring status verification. The separate `/api/1.0/Payments/BillInquiry` and `/api/1.0/Payments/BillPayment` adapters follow their provider envelope and credentials; confirm those contracts during real UAT.
