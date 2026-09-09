# Fintap server

Express 5 and MySQL 8 backend for the Fintap multi-tenant invoice and payment platform. The active product roles are platform administrator, school tenant, and organization/private-agency tenant.

## Runtime boundaries

- Production uses `APP_ENVIRONMENT=production`; invoice-based 1LINK routes are enabled.
- Sandbox uses `APP_ENVIRONMENT=sandbox`; its database name must contain `sandbox`, `uat`, or `test`, and 1LINK routes are disabled.
- HTTP binds to `127.0.0.1`; Nginx terminates TLS and forwards the source address.
- The durable webhook outbox runs as a separate PM2 worker.

Never share `.env`, database credentials, JWT/webhook secrets, tenant API keys, the IPsec PSK, or a TLS private key.

## Local setup

```bash
npm install
cp .env.example .env
npm run migrate
npm run dev
```

For localhost, keep `NODE_ENV=development` and `REQUIRE_HTTPS=false`. Production must use `REQUIRE_HTTPS=true` behind the trusted one-hop reverse proxy.

## Verification

```bash
npm test
npm run lint
npm audit --omit=dev
```

Database integration tests require a disposable MySQL database and explicit opt-in. Never point tests at production.

## Production deployment

Use [`../docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](../docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md). The core commands are:

```bash
npm ci
npm run migrate
pm2 startOrReload ecosystem.config.cjs --update-env
```

Production migration refuses `--fresh` and refuses to create a missing database. Migration `007_production_foundation.js` is additive and checksum-ledgered; after deployment, create a new numbered migration instead of editing it.

## Authentication

Dashboard sessions use a short-lived JWT access token plus a rotating HttpOnly/Secure/SameSite refresh cookie. Only refresh-token hashes are stored.

Tenant integrations use `X-API-Key`. Keys are generated once, stored only as SHA-256 hashes, displayed only during creation/rotation, and scoped to the live or sandbox runtime.

The dedicated 1LINK routes use the agreed `username` and `password` headers plus the production source-IP allowlist:

```text
POST /api/1.0/Payments/BillInquiry
POST /api/1.0/Payments/BillPayment
```

## Core APIs

| Area | Base route | Access |
|---|---|---|
| Authentication | `/api/auth` | Public login/refresh; authenticated profile/logout |
| Billers | `/api/tenants` | Platform admin |
| Users | `/api/users` | Platform admin; scoped school sub-user operations |
| Students | `/api/students` | Platform admin or school, role restricted |
| Invoices | `/api/invoices` | Platform admin or school, role restricted |
| Manual payment/reversal | `/api/manual-payments` | Admin/tenant finance roles, live tenant only |
| Organization portal | `/api/org` | Platform admin or organization |
| Organization payments | `/api/payments`, `/api/payment`, `/api/stats` | JWT or tenant key as defined per route |
| Tenant API | `/api/saas/v1` | Environment-scoped tenant key |
| 1LINK invoice service | `/api/1.0/Payments` | Gateway credentials and source allowlist |
| Reports/audit | `/api/reports`, `/api/audit-logs` | Authenticated and role/tenant scoped |

## Financial posting rules

All real paid outcomes delegate to `services/paymentPostingService.js`. One successful commit creates payment evidence, transaction, allocation, invoice/org status, ledger effect where applicable, financial audit row, and outbox event atomically. External reference/idempotency uniqueness prevents retry duplicates.

The UI cannot directly toggle an invoice to paid. “Record payment” requires an exact amount, unique reference, reason, timestamp, channel, and typed consumer confirmation. Manual corrections create compensating reversal records; 1LINK/external payments require settlement reconciliation and cannot be reversed locally.

## Tenant lifecycle and consumer numbers

- Account status (`active`, `suspended`, `banned`) is separate from onboarding lifecycle (`testing`, `ready_for_live`, `live`, `offboarding`).
- Suspended tenants retain read-only dashboard access, while payment writes and 1LINK visibility are blocked.
- Live activation requires the explicit five-part checklist and typed confirmation.
- New tenants use an exact 14- or 24-digit consumer-number policy. Existing 20-digit identifiers remain valid.
- Allocation is centralized, numeric, capacity checked, and serialized by a tenant row lock.

## FetchBundle retirement

FetchBundle application routes, controllers, pages, clients, and active tests are removed because the requested onboarding scope is invoice based. Legacy bundle tables are retained for one rollback release only and have no active readers. Written 1LINK confirmation is required before a later migration drops them.

## Webhooks

Payment commits enqueue `outbox_events`. The worker signs the exact JSON body with HMAC-SHA256, sends `X-Fintap-Event-Id` and `X-Webhook-Signature`, permits only public HTTPS port 443 destinations, retries with exponential backoff, and reclaims events abandoned during a worker crash.

## Documentation

- [`../docs/IMPLEMENTATION_AUDIT_2026-09-08.md`](../docs/IMPLEMENTATION_AUDIT_2026-09-08.md)
- [`../docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](../docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [`../docs/1BILL_HANDOVER_AND_COMPLIANCE_2026-09-08.md`](../docs/1BILL_HANDOVER_AND_COMPLIANCE_2026-09-08.md)
- [`src/db/SCHEMA.md`](src/db/SCHEMA.md)
