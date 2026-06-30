# Webhooks — Setup & Integration Guide

**Project:** Billing Brilliance / Payniva  
**Version:** 1.0  
**Audience:** Integration developers, DevOps, and backend engineers

---

## Overview

The platform has **two webhook directions**:

| Direction | Who calls whom | Purpose |
|-----------|---------------|---------|
| **Inbound** (1LINK → Platform) | 1LINK/1BILL sends a `POST` to the platform after a payment is processed | Platform receives payment confirmation and updates records |
| **Outbound** (Platform → Your Server) | Platform pushes a `POST` to your registered `notification_url` | Your system receives real-time payment status updates |

```
Applicant pays at ATM / JazzCash / bank branch
         │
         ▼
  1LINK confirms payment
         │
         ▼
  POST /api/payment/callback           ← Inbound webhook (1LINK → Platform)
         │
         ▼
  Platform updates payment record
         │
         ▼
  POST {notification_url}              ← Outbound webhook (Platform → Your Server)
```

---

## 1. Inbound Webhook — 1LINK Payment Callback

### Endpoint

```
POST /api/payment/callback
```

This is called **by 1LINK / 1BILL**, not by you. You must ensure your server is reachable at this URL and that the signature validation passes.

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | ✅ | `application/json` |
| `X-Webhook-Signature` | ✅ (production) | HMAC-SHA256 signature for verification |
| `X-Idempotency-Key` | Recommended | Unique key to prevent duplicate processing |

### Request Payload

```json
{
  "billId":        "ORG-A1B2C3D4",
  "status":        "paid",
  "transactionId": "TXN-1LINK-00239841",
  "paidAt":        "2026-04-12T08:34:21.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `billId` | string | ✅ | The bill ID returned when the payment was created |
| `status` | string | ✅ | `paid`, `failed`, or `expired` |
| `transactionId` | string | ✅ (if paid) | 1LINK transaction reference |
| `paidAt` | string (ISO 8601 UTC) | ✅ (if paid) | When the payment was confirmed |

### Success Response

```json
{
  "data": {
    "acknowledged": true,
    "payment": { "...updated payment record..." },
    "message": "Callback processed. Payment marked paid"
  }
}
```

### Error Responses

| HTTP | Code | Cause |
|------|------|-------|
| `401` | `INVALID_SIGNATURE` | `X-Webhook-Signature` header missing or incorrect |
| `400` | `VALIDATION_ERROR` | Missing required fields in callback body |
| `200` | (acknowledged: false) | Bill ID not found in the database |

### Idempotency

If 1LINK sends the same callback twice, the platform uses the `X-Idempotency-Key` header to deduplicate. The second call returns the cached response immediately without re-processing.

- If `X-Idempotency-Key` is provided, the response is stored in `callback_idempotency_log`.
- A duplicate `paid` callback for an already-paid bill is safely ignored.
- A duplicate transaction ID used on a different bill is rejected.

---

## 2. Outbound Webhook — Payment Notification to Your Server

After the platform processes an inbound callback from 1LINK, it immediately fires a `POST` to your configured `notification_url` with the updated payment status.

### What Your Server Receives

```
POST https://your-server.com/your-webhook-path
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-hex>
```

### Payload

```json
{
  "application_id": "APP-44521",
  "status":         "paid",
  "transaction_id": "TXN-1LINK-00239841",
  "paid_at":        "2026-04-12T08:34:21.000Z"
}
```

| Field | Description |
|-------|-------------|
| `application_id` | Matches the ID you passed to `POST /api/payments/create` |
| `status` | `paid`, `failed`, or `expired` |
| `transaction_id` | 1LINK reference (only present when `status = paid`) |
| `paid_at` | UTC datetime of confirmed payment (only present when `status = paid`) |

### What Your Server Should Do

1. Verify the `X-Webhook-Signature` header (see **Signature Verification** below).
2. Match `application_id` to the applicant/student in your system.
3. Update their payment status to `paid`.
4. Trigger downstream processing (shortlisting, confirmation email, admit card generation, etc.).
5. Return any `2xx` HTTP status — the platform does not inspect the response body.

```json
{ "received": true }
```

### Delivery Behavior

- Fire-and-forget with an **8-second timeout**.
- No automatic retries — if your endpoint is down, delivery is lost. Use the notification log in the dashboard to replay missed events.
- Every delivery attempt is recorded in `org_payment_notifications` / `etea_payment_notifications`.

---

## 3. Signature Verification

All webhooks are protected by an HMAC-SHA256 signature included in the `X-Webhook-Signature` header.

### Inbound Callback Signature (1LINK → Platform)

The platform verifies incoming 1LINK callbacks. The signature is computed as:

```
HMAC-SHA256(
  key   = ORG_WEBHOOK_SECRET,
  input = "{billId}|{status}|{transactionId}|{paidAt}"
)
```

This is automatically validated by the `processPaymentCallback` controller before any processing occurs.

### Outbound Notification Signature (Platform → Your Server)

When pushing to your `notification_url`, the platform computes:

```
HMAC-SHA256(
  key   = webhook_secret (per-tenant or global ORG_WEBHOOK_SECRET),
  input = JSON.stringify(notificationPayload)
)
```

The hex digest is sent in `X-Webhook-Signature`.

### Verifying in Your Server (Node.js example)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(req, webhookSecret) {
  const provided = req.headers['x-webhook-signature'];
  if (!provided) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(expected)
  );
}

// In your Express route:
app.post('/your-webhook-path', express.json(), (req, res) => {
  if (!verifyWebhookSignature(req, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { application_id, status, transaction_id, paid_at } = req.body;

  if (status === 'paid') {
    // Update your database
  }

  res.json({ received: true });
});
```

### Verifying in PHP

```php
function verifyWebhookSignature(string $payload, string $signature, string $secret): bool {
    $expected = hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $signature);
}

$payload   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

if (!verifyWebhookSignature($payload, $signature, getenv('WEBHOOK_SECRET'))) {
    http_response_code(401);
    exit(json_encode(['error' => 'Invalid signature']));
}

$data = json_decode($payload, true);
// Process $data['application_id'], $data['status'], etc.
```

---

## 4. Setup & Configuration

### Step 1 — Configure Environment Variables

Copy `.env.example` to `.env` in the `server/` directory and set:

```env
# Your HMAC secret — must be a long random string (32+ characters)
# Share this with 1LINK so they can sign their callbacks to you
ORG_WEBHOOK_SECRET=replace_with_a_long_random_string

# URL where the platform listens for 1LINK callbacks
# (This is YOUR server's /api/payment/callback endpoint)
ORG_CALLBACK_URL=/api/payment/callback

# URL where your external system receives payment notifications
# (Platform POSTs here after a payment is confirmed)
# Optional — can also be set per-tenant in the dashboard
# ORG_NOTIFICATION_URL=https://your-server.com/api/payment-webhook

# Enforce signature checks — always true in production
REQUIRE_WEBHOOK_SIGNATURE=true

# How long consumer numbers stay valid (hours)
ORG_PAYMENT_EXPIRY_HOURS=48
```

### Step 2 — Register Your Notification URL

**Option A: Environment variable (applies to all tenants)**

```env
ORG_NOTIFICATION_URL=https://your-server.com/api/payment-webhook
```

**Option B: Per-tenant in the database (overrides env)**

Update the `tenants.settings` JSON column for your tenant:

```json
{
  "notification_url": "https://your-server.com/api/payment-webhook",
  "webhook_secret":   "your-per-tenant-secret"
}
```

Per-tenant settings take precedence over the global env variable.

### Step 3 — Register Your Server IP (Production)

For ETEA/Org endpoints, the platform enforces an IP whitelist. Add your server's public IP in the dashboard under **Settings → Security → Allowed Source IPs** or update the `etea_security_context` setting in the `settings` table:

```json
{
  "sourceIp": "203.0.113.10,203.0.113.11"
}
```

### Step 4 — Start the Server

```bash
cd server
npm install
cp .env.example .env
# Fill in .env values
npm run migrate
npm run seed
npm run dev       # development
npm start         # production
```

---

## 5. Webhook Security Checklist

| Control | How it works | Config |
|---------|-------------|--------|
| **HMAC Signature** | All callbacks verified via `X-Webhook-Signature` | `ORG_WEBHOOK_SECRET` |
| **Signature Toggle** | Can be disabled for local sandbox testing | `REQUIRE_WEBHOOK_SIGNATURE=false` |
| **IP Whitelist** | Only registered IPs accepted (per-tenant) | Dashboard → Settings → Security |
| **HTTPS Enforcement** | Platform rejects `http://` in production | `REQUIRE_HTTPS=true` |
| **Idempotency** | Duplicate callbacks safely deduplicated | `X-Idempotency-Key` header |
| **Duplicate TXN Check** | Same transaction ID on two bills is rejected | Automatic |
| **Timeout** | Outbound webhook times out after 8 seconds | Hardcoded |
| **Rate Limiting** | 100 requests/15 min globally, 20/15 min auth routes | `RATE_LIMIT_*` env vars |

---

## 6. Notification Log

Every outbound webhook push is recorded in the `org_payment_notifications` table:

| Column | Description |
|--------|-------------|
| `id` | UUID |
| `tenant_id` | Which tenant the payment belongs to |
| `application_id` | Application reference |
| `payment_id` | Internal payment record UUID |
| `bill_id` | The bill ID (e.g. `ORG-A1B2C3D4`) |
| `status` | `pending`, `paid`, `expired`, or `failed` |
| `created_at` | When the notification was recorded |

Access the log via the dashboard or the API:

```
GET /api/payment-notifications
Authorization: Bearer <jwt-token>
```

---

## 7. Testing Webhooks Locally

### Simulate an Inbound Callback (1LINK → Platform)

Use `curl` or a tool like Postman to fire a test callback:

```bash
BILL_ID="ORG-A1B2C3D4"
STATUS="paid"
TXN_ID="TXN-TEST-001"
PAID_AT="2026-05-22T10:00:00.000Z"
SECRET="your-webhook-secret"

# Build signature string
SIG_INPUT="${BILL_ID}|${STATUS}|${TXN_ID}|${PAID_AT}"

# Compute HMAC-SHA256
SIGNATURE=$(echo -n "$SIG_INPUT" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST http://localhost:3000/api/payment/callback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Idempotency-Key: test-key-001" \
  -d "{\"billId\":\"$BILL_ID\",\"status\":\"$STATUS\",\"transactionId\":\"$TXN_ID\",\"paidAt\":\"$PAID_AT\"}"
```

### Expose Your Local Server for Outbound Webhooks

Use [ngrok](https://ngrok.com/) or a similar tunnel to receive outbound webhooks during development:

```bash
ngrok http 3001   # your local webhook receiver port
```

Then set your `ORG_NOTIFICATION_URL` (or tenant `notification_url`) to the ngrok HTTPS URL.

### Disable Signature Verification in Sandbox

```env
REQUIRE_WEBHOOK_SIGNATURE=false
```

> **Warning:** Never disable signature verification in production.

---

## 8. Quick Reference

### Inbound (1LINK → Platform)

| Item | Value |
|------|-------|
| Endpoint | `POST /api/payment/callback` |
| Auth | `X-Webhook-Signature` HMAC-SHA256 |
| Idempotency | `X-Idempotency-Key` header |
| Signature input | `billId\|status\|transactionId\|paidAt` (pipe-delimited) |
| Signature key | `ORG_WEBHOOK_SECRET` env var |

### Outbound (Platform → Your Server)

| Item | Value |
|------|-------|
| Trigger | Payment callback received from 1LINK and processed |
| Target URL | `notification_url` in tenant settings or `ORG_NOTIFICATION_URL` env |
| Auth | `X-Webhook-Signature` HMAC-SHA256 of JSON payload |
| Timeout | 8 seconds |
| Retries | None (check notification log for missed events) |
| Expected response | Any `2xx` status |

### Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ORG_WEBHOOK_SECRET` | `change-me` | HMAC secret for signature validation |
| `ORG_CALLBACK_URL` | `/api/payment/callback` | Where 1LINK sends callbacks |
| `ORG_PAYMENT_EXPIRY_HOURS` | `48` | Consumer number TTL |
| `REQUIRE_WEBHOOK_SIGNATURE` | `true` | Enforce signature checks |
| `REQUIRE_HTTPS` | `false` | Enforce HTTPS for all requests |

---

## 9. Error Handling & Debugging

### Common Issues

**`401 INVALID_SIGNATURE`**
- Signature mismatch. Check that `ORG_WEBHOOK_SECRET` on both sides matches exactly.
- Ensure the canonical string format is `billId|status|transactionId|paidAt` (no spaces, pipe-delimited).
- Empty `paidAt` should be an empty string `""`, not `null`.

**`403 IP_BLOCKED`**
- Your server's IP is not in the whitelist. Add it via the dashboard or `etea_security_context` setting.

**Outbound webhook not firing**
- Check that `notification_url` is set in tenant settings or `ORG_NOTIFICATION_URL` env.
- Look in server logs for `Org webhook push →` messages or `Org webhook push failed →` warnings.
- Check the `org_payment_notifications` table to confirm the callback was processed.

**Duplicate callbacks**
- This is handled automatically. The `callback_idempotency_log` table stores processed keys; duplicates return the cached response.

### Server Log Messages

| Log message | Meaning |
|-------------|---------|
| `Org webhook push → {url} \| status=200` | Outbound notification delivered successfully |
| `Org webhook push failed → {url} \| {error}` | Delivery failed (timeout, DNS error, 5xx) |
| `IP_BLOCKED: incoming="{ip}"` | IP whitelist rejection |
