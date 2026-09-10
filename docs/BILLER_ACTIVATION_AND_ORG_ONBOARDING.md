# Biller activation and organization onboarding

## What “Activate biller” means

Activation is the controlled transition from `testing` to `live` for one tenant. Before activation, the tenant account is valid and can prepare people, configuration, source-IP allowlists, webhooks, and sandbox test data. It cannot create production invoices/payment requests or post production payments. After activation, those production financial paths are enabled.

Activation does not:

- change existing consumer numbers;
- copy sandbox records into production;
- mark any invoice paid;
- remove a suspension;
- establish the 1LINK IPsec tunnel.

Account status and lifecycle are separate. A tenant may be `active + testing`, `active + live`, or `suspended + live`. Suspension temporarily makes all of the tenant’s consumers unavailable to collection channels while preserving identifiers and history.

## Recommended onboarding process

### 1. Commercial and ownership intake

Collect the legal name, display name, tenant type, billing/support contacts, authorized technical contact, settlement contact, data-retention owner, and approval/ticket reference. The platform admin creates the biller in `testing` and chooses its permanent 14- or 24-digit consumer-number policy.

### 2. Tenant administrator

Create the tenant administrator, verify their email/identity through the agreed business process, and require a password change through the normal secure account flow. Do not send passwords or API keys in group chats.

### 3. Production integration configuration

The organization supplies its callback URL and public source IPs. Configure the source-IP allowlist and webhook secret. The production API key is delivered once through an approved secure channel. The organization stores it only in its server-side secret manager.

### 4. Isolated sandbox provisioning

From Admin > Billers, choose “Provision isolated sandbox,” enter the administrator PIN, and type the exact tenant name. The separate sandbox service creates the same tenant identity in its own database and returns a `fintap_test_…` key. This key cannot authenticate against production.

The organization uses `/org/sandbox` to:

- create disposable consumers and invoices;
- check unpaid/paid status;
- simulate exact payments and retry/idempotency behavior;
- verify request/response parsing and error handling;
- verify its webhook receiver using synthetic events.

### 5. UAT evidence

Retain evidence for successful creation, inquiry, payment, duplicate retry, invalid key, invalid source IP, blocked consumer, paid consumer, expired request, 14/24-digit identifiers as applicable, webhook signature verification, and pagination (`page >= 1`, `limit 1–30`).

### 6. Readiness review

The platform operator verifies:

- profile and ownership details;
- production credential handoff;
- source-IP allowlist/routing;
- webhook endpoint and signature handling;
- consumer-number capacity and policy;
- completed UAT evidence;
- operational/support/settlement contacts;
- rollback and first-day monitoring owners.

### 7. Activation

Admin selects Activate, ticks every checklist item, types the tenant name, and enters the six-digit `ADMIN_ACTION_PIN`. The server first asks the isolated sandbox to delete the tenant’s test rows and revoke its test key. If the sandbox cannot confirm that purge, production activation fails closed. On success, the production lifecycle becomes `live` and the action is audited.

### 8. Go-live observation

Create a small controlled production invoice/payment request, verify inquiry and payment behavior, confirm the tenant webhook and outbox delivery, reconcile the first transaction, and then close the onboarding ticket.

## Client-facing organization API

Organizations use only:

- `POST /api/payments/create` — create an invoice-based payment request;
- `GET /api/payments/{application_id}` — check one request;
- `GET /api/payments?page=1&limit=30` — list requests;
- `GET /api/payment-notifications?page=1&limit=30` — list notification history;
- signed outbound payment webhooks — receive server-to-server notifications.

`/api/1.0/Payments/BillInquiry` and `/api/1.0/Payments/BillPayment` are private Fintap-to-1LINK endpoints. Tenant developers do not call them and they are intentionally absent from their dashboard documentation.

## Privileged key and offboarding behavior

Full production API keys are hidden by default. A platform admin can reveal a newly created/rotated key only after PIN verification. Legacy hash-only keys cannot be revealed and must be rotated. Rotation immediately invalidates the old key and is audited.

“Delete biller” is implemented as audited offboarding. The biller must first be suspended, then the admin supplies a reason, exact-name confirmation, and PIN. Users and API credentials are disabled, while invoices, payments, ledgers, transactions, and audit evidence are retained for reconciliation and legal/financial recordkeeping.

## Infrastructure ownership

Application code supplies the lifecycle and isolation controls. Operations must separately deploy the sandbox hostname, TLS certificate, runtime, database/user, `API_KEY_ENCRYPTION_KEY`, `ADMIN_ACTION_PIN`, `SANDBOX_BASE_URL`, and `SANDBOX_PURGE_SECRET`. The production sandbox runtime must have no route to the 1LINK VPN or settlement services.

The 1LINK IPsec tunnel remains a separate network dependency. Activation of a tenant in Fintap does not replace 1LINK’s responsibility to configure its peer and whitelist the Fintap public IP.
