# ETEA Payment API — Integration Guide

**Version:** 1.0  
**Base URL:** `https://your-domain.com/api`  
**Audience:** ETEA Technical Integration Team

---

## Overview

This API enables ETEA to create payment requests for applicants, check payment status, and receive real-time payment confirmations from the 1BILL network. When an applicant pays using their generated consumer number (via ATM, mobile banking, or bank branch), your system is notified automatically.

### End-to-End Flow

```
1. ETEA calls POST /api/payments/create
        → System generates a consumer number (1BILL)
        → Returns consumer number to display to applicant

2. Applicant pays at ATM / mobile app / bank branch using the consumer number

3. 1LINK → 1BILL confirms the payment → System updates status to "paid"

4. System pushes a notification to ETEA_NOTIFICATION_URL (your webhook endpoint)
        → No polling required — ETEA receives real-time confirmation

5. ETEA can verify anytime via GET /api/payments/{application_id}
```

---

## Authentication

All endpoints require an **API Key** issued by the platform administrator.

Include it in every request header:

```
X-API-Key: your-api-key-here
```

**IP Whitelisting:** In production, only requests from ETEA's registered server IPs are accepted. Contact the platform admin to register your IPs.

---

## Endpoints

### 1. Create Payment Request

**`POST /api/payments/create`**

Called when an applicant submits an application. Returns a 1BILL consumer number the applicant uses to pay.

#### Request Headers

| Header | Required | Value |
|--------|----------|-------|
| `X-API-Key` | ✅ | Your organization API key |
| `Content-Type` | ✅ | `application/json` |

#### Request Body

```json
{
  "applicant_id":   "STU-9981",
  "application_id": "APP-44521",
  "posting_id":     "LECTURER-KPK-2026",
  "amount":         1200,
  "expires_in_minutes": 2880,
  "never_expires":  false,
  "customer_name":  "Ali Khan",
  "description":    "Lecturer application fee"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applicant_id` | string | ✅ | Your internal applicant identifier |
| `application_id` | string | ✅ | Unique application reference — used for all future lookups |
| `posting_id` | string | ✅ | The job posting the fee is for |
| `amount` | number | ✅ | Fee amount in PKR (must be > 0) |
| `expires_in_minutes` | number | ❌ | How long the consumer number stays valid (default: 2880 = 48 hrs) |
| `never_expires` | boolean | ❌ | Set `true` for open-ended postings — consumer number never expires |
| `customer_name` | string | ❌ | Applicant's full name (shown on payment receipt) |
| `description` | string | ❌ | Fee description (auto-derived from posting if omitted) |

> **Idempotent:** Calling this endpoint twice with the same `application_id` returns the existing payment record — no duplicate is created.

#### Response `201 Created`

```json
{
  "data": {
    "application_id":  "APP-44521",
    "consumer_number": "12345600012345670001",
    "amount":          1200,
    "status":          "pending",
    "expires":         "2026-04-13T10:00:00.000Z",
    "never_expires":   false,
    "customer_name":   "Ali Khan",
    "description":     "Lecturer application fee"
  }
}
```

| Field | Description |
|-------|-------------|
| `consumer_number` | **Give this to the applicant.** They use it to pay at any ATM, JazzCash, EasyPaisa, or bank branch via 1BILL |
| `status` | Always `pending` on creation |
| `expires` | UTC datetime after which the consumer number is no longer payable |

#### Error Responses

```json
{ "error": "applicant_id is required",    "code": "VALIDATION_ERROR", "status": 400 }
{ "error": "Amount must be > 0",          "code": "VALIDATION_ERROR", "status": 400 }
{ "error": "Invalid API key",             "code": "INVALID_API_KEY",  "status": 401 }
{ "error": "Source IP not whitelisted",   "code": "IP_BLOCKED",       "status": 403 }
```

---

### 2. Check Payment Status

**`GET /api/payments/{application_id}`**

Look up the current status of a specific applicant's payment. Use this before shortlisting or processing an application to confirm fee clearance.

#### Request Headers

| Header | Required | Value |
|--------|----------|-------|
| `X-API-Key` | ✅ | Your organization API key |

#### Request Example

```
GET /api/payments/APP-44521
X-API-Key: your-api-key-here
```

#### Response `200 OK` — Payment found

```json
{
  "data": {
    "application_id":  "APP-44521",
    "status":          "paid",
    "consumer_number": "12345600012345670001",
    "amount":          1200,
    "expires":         "2026-04-13T10:00:00.000Z",
    "paid_at":         "2026-04-12T08:34:21.000Z",
    "transaction_id":  "TXN-1LINK-00239841"
  }
}
```

#### Response `200 OK` — Not found

```json
{
  "data": {
    "application_id": "APP-44521",
    "status":         "not_found"
  }
}
```

#### Payment Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Consumer number generated, payment not yet received |
| `paid` | Payment confirmed by 1LINK — safe to process application |
| `expired` | Consumer number expired before payment was made |
| `failed` | Payment was attempted but failed |

---

### 3. List All Payments

**`GET /api/payments`**

Returns a paginated list of all payment records. Use for reconciliation, audit, or bulk verification at month-end.

#### Request Headers

| Header | Required | Value |
|--------|----------|-------|
| `X-API-Key` | ✅ | Your organization API key |

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Records per page (max 200) |
| `status` | string | — | Filter: `pending`, `paid`, `expired`, `failed` |
| `from` | datetime | — | Filter records created on or after (e.g. `2026-04-01`) |
| `to` | datetime | — | Filter records created on or before (e.g. `2026-04-30`) |
| `application_id` | string | — | Filter to a single application |

#### Request Example

```
GET /api/payments?status=paid&from=2026-04-01&to=2026-04-30&page=1&limit=100
X-API-Key: your-api-key-here
```

#### Response `200 OK`

```json
{
  "data": [
    {
      "application_id":  "APP-44521",
      "applicant_id":    "STU-9981",
      "posting_id":      "LECTURER-KPK-2026",
      "consumer_number": "12345600012345670001",
      "amount":          1200,
      "status":          "paid",
      "created_at":      "2026-04-11T09:00:00.000Z",
      "paid_at":         "2026-04-12T08:34:21.000Z",
      "transaction_id":  "TXN-1LINK-00239841",
      "expiry_date":     "2026-04-13T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 284,
    "page":  1,
    "limit": 100,
    "pages": 3
  }
}
```

---

### 4. Receive Payment Notifications (Inbound Webhook)

**`POST /api/etea/payment-status`**

> ⚠️ **This endpoint is called BY the billing system TO ETEA — not by ETEA.**

When a payment is confirmed by 1LINK, the billing system immediately sends a POST request to your registered webhook URL (`ETEA_NOTIFICATION_URL`). Implement this endpoint on ETEA's server to receive real-time payment confirmations.

#### Your Webhook Must Accept

```
POST https://etea.gov.pk/api/payment-webhook
Content-Type: application/json
```

#### Payload Your Server Receives

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
| `status` | `paid`, `expired`, or `failed` |
| `transaction_id` | 1LINK transaction reference (present when `status = paid`) |
| `paid_at` | UTC datetime of confirmed payment |

#### What ETEA Should Do on Receipt

1. Match `application_id` to the applicant in your system
2. Update their payment status to `paid`
3. Trigger any downstream processing (shortlisting, confirmation email, etc.)
4. Optionally push a WebSocket/SSE event to the applicant's open browser tab so the page updates without refresh

#### Your Webhook Response

Return any `2xx` status. The billing system does not process the response body.

```json
{ "received": true }
```

> **Note:** The notification log in the billing dashboard shows every outbound push sent to your webhook, including status and timestamp.

---

### 5. Health Check

**`GET /api/health`**

Verify the payment service is online. No authentication required. Use in monitoring dashboards or before making critical calls.

#### Response `200 OK`

```json
{
  "data": {
    "service":   "etea-payment-controller",
    "status":    "ok",
    "timestamp": "2026-04-11T10:23:45.123Z"
  }
}
```

---

## Security Summary

| Control | Details |
|---------|---------|
| API Key | All requests must include `X-API-Key` header |
| IP Whitelist | In production, only registered ETEA server IPs are accepted |
| Webhook Signature | Callbacks from 1LINK are verified via `X-Webhook-Signature` HMAC |
| Idempotency | Duplicate `POST /api/payments/create` calls for the same `application_id` are safe — returns existing record |

---

## Quick Reference

| Method | Endpoint | Called By | Purpose |
|--------|----------|-----------|---------|
| `POST` | `/api/payments/create` | ETEA → Platform | Create payment, get consumer number |
| `GET` | `/api/payments/{application_id}` | ETEA → Platform | Check if a specific applicant paid |
| `GET` | `/api/payments` | ETEA → Platform | Bulk reconciliation with filters |
| `POST` | `{ETEA_NOTIFICATION_URL}` | Platform → ETEA | Real-time push when payment confirmed |
| `GET` | `/api/health` | ETEA → Platform | Service availability check |

---

## Contact

For API key provisioning, IP whitelisting, or integration support, contact the platform administrator.
