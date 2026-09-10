# Fintap onboarding, credential, lifecycle, and dashboard change plan

Status: implementation planned; acceptance evidence will be appended as each phase passes
Prepared: 10 September 2026

## 1. Requested outcomes

This change set will make the tenant lifecycle visible and enforceable, restrict financial posting to trusted channels, protect privileged credential actions with a six-digit administrator PIN, clarify the client-facing organization API, replace dashboard refresh loops with server-pushed payment events, and turn the organization sandbox into a genuinely isolated test environment.

The existing production VPN, protected IP, Nginx listener, TLS certificate, and 1LINK routes are outside this change set. Application work must not modify those network controls.

## 2. Product meaning: activate a biller

“Activate biller” means moving an approved tenant from `testing` to `live`. It does not create or replace consumer numbers, change the tenant’s suspension status, or copy test transactions into production.

Before activation, the tenant may configure its profile, create/import its own non-financial master data, and use the separate sandbox. Production invoice/payment creation and production collection APIs remain blocked. At activation the platform administrator verifies the onboarding checklist, invalidates and purges that tenant’s sandbox credentials/data, issues or confirms production credentials, and records an immutable audit event. After activation, production invoice creation and collection become available.

Suspension is a different control. A live biller can be suspended temporarily. Its identifiers and financial history remain stored, while inquiry/payment channels behave as unavailable. Restoring the biller makes the same identifiers usable again.

## 3. Organization onboarding flow

1. Platform admin creates the tenant with its legal/display name, tenant type, consumer-number length, operational contact, and lifecycle `testing`.
2. The system creates the tenant administrator and gives production credentials through a one-time secure handoff. Production financial writes remain lifecycle-blocked.
3. The client completes its profile, callback/webhook configuration, source-IP allowlist, support contacts, and API integration configuration.
4. The platform provisions the client in the physically separate sandbox runtime/database. The client receives a sandbox-only key and may create disposable consumers and exercise inquiry/payment flows there.
5. The client completes positive, negative, duplicate/idempotency, paid, expired, and blocked-consumer UAT. Production data is never used for this testing.
6. Operations checks the onboarding evidence: profile, credentials, allowlist, webhook, consumer-number policy, UAT result, support/settlement contacts, and approval ticket.
7. Admin selects Activate, enters the six-digit privileged-action PIN, types the tenant-specific confirmation, and confirms the checklist.
8. The activation workflow purges/revokes sandbox state, records audit evidence, then changes production lifecycle to `live`. It must fail closed if a configured sandbox cannot confirm purge.
9. The tenant uses only client-facing production APIs. 1LINK BillInquiry and BillPayment endpoints remain private server-to-1LINK contracts and are not shown in the tenant dashboard.
10. Operations monitors the first production invoices, callbacks, outbox retries, reconciliation, and 1LINK responses before closing onboarding.

## 4. Safety decisions

### 4.1 API-key reveal

Existing API keys are intentionally hash-only and cannot be reconstructed. Fabricating a “reveal” from the hash would be impossible and insecure. New and rotated keys will therefore keep the hash as the authentication verifier and additionally store an AES-256-GCM encrypted copy solely for PIN-gated administrative recovery. Encryption uses a dedicated `API_KEY_ENCRYPTION_KEY`, not the PIN. The PIN only authorizes the operation.

Legacy hash-only keys will show “not recoverable; rotate to create a recoverable key.” Every reveal attempt is rate-limited and audited. The secret is never returned in tenant list/profile responses or logs.

### 4.2 PIN controls

`ADMIN_ACTION_PIN` must be exactly six digits. Production startup must reject missing/invalid PIN or credential-encryption configuration when these privileged features are enabled. PIN comparison is constant-time; failures are generically reported, rate-limited, and audited without logging the PIN.

Regeneration immediately invalidates the old production key. The modal therefore requires the PIN plus a tenant-specific typed confirmation and warns that connected systems must be updated. Biller deletion is an audited soft offboarding action, not a physical deletion of invoices, payments, ledgers, or audit history.

### 4.3 Manual payments

Tenant dashboard users will not be able to post or reverse payments manually. Only the platform admin verification workflow may post a controlled manual payment, using the same atomic payment service as 1LINK. This preserves reconciliation and prevents schools/organizations from self-reporting collections without trusted evidence.

### 4.4 Testing lifecycle

Testing tenants may populate students/applicants and configuration so onboarding is possible. Production invoice generation, payment-request creation, payment posting, scheduled billing, and production API mutations remain blocked server-side. UI disabling and banners are explanatory controls; the server is the authority.

### 4.5 Sandbox isolation

Sandbox is a separate runtime and database with separate keys and no 1LINK VPN access. A page label, request flag, or shared production table is not accepted as isolation. Production activation must close the sandbox UI, revoke its key, and request a tenant-scoped purge from the sandbox service. Financial test rows are never promoted.

### 4.6 Real-time dashboard

The browser cannot directly receive the outbound webhook sent to a client server. The production dashboard will use an authenticated server-sent event stream emitted after canonical payment commits. Webhooks remain the organization server-to-server notification channel. The UI refetches only after a pushed event, not on an interval.

## 5. Implementation sequence

### Phase A — database and configuration foundations

- Add versioned migration fields for encrypted API-key material and any activation/sandbox cleanup evidence.
- Add validated `ADMIN_ACTION_PIN`, `API_KEY_ENCRYPTION_KEY`, sandbox service URL, and sandbox purge secret configuration.
- Extend API-key creation/rotation to store hash, prefix, and encrypted material atomically.
- Keep compatibility for legacy hash-only rows.

Effect: schema remains additive and existing credentials continue authenticating. Rollback can ignore the new nullable fields.

### Phase B — lifecycle enforcement

- Make live lifecycle enforcement independent of `NODE_ENV`; bypass it only inside the explicitly configured sandbox runtime.
- Allow testing tenants to maintain non-financial master data.
- Block invoice/payment-request creation and every production posting path for non-live tenants.
- Add a shared lifecycle banner/instruction panel to school and organization dashboards and consistent testing-phase error messages.
- Require PIN and completed checklist for activation, including sandbox purge acknowledgement.

Effect: a hidden/disabled button can no longer be bypassed with a direct API call.

### Phase C — privileged admin actions

- Add PIN verification middleware/service with rate limiting and audit logging.
- Add admin-only API-key reveal and rotate endpoints.
- Update admin biller management modals for hidden display, reveal, rotate, and soft offboarding with PIN.
- Fix the organization key identifier by including only the prefix/identifier in authenticated profile data.

Effect: normal dashboards never receive full keys. Legacy users must rotate once before reveal becomes available.

### Phase D — financial action restrictions

- Remove record/reverse payment controls from school and organization dashboards.
- Restrict manual payment endpoints to platform admins.
- Remove “This Session” from school real-time payments.
- Confirm paid-state changes continue only through the canonical posting/reversal service.

Effect: tenant financial history cannot be altered by dashboard convenience actions.

### Phase E — organization API and payments UX

- Remove private 1LINK BillInquiry/BillPayment documentation from `/org/api-integration`.
- Document only tenant APIs: create request, check status, list payments with page/limit 1–30, and webhook notification verification.
- Make `customer_name` mandatory in UI validation and backend validation.
- Make `never_expires=true` authoritative and ignore any expiry interval/value supplied in the same request.
- Redesign `/org/payments` around clear summary, creation, status, and history tasks.

Effect: the client sees the contract it is expected to consume, without exposing internal bank-facing endpoints.

### Phase F — pushed real-time updates and dashboard layout

- Add tenant-scoped authenticated server-sent payment events emitted after database commit.
- Reconnect safely with backoff and refetch only after pushed events.
- Remove global top-right search from all dashboard layouts.
- Debounce/filter local searches so typing does not issue one request per keystroke.
- Add responsive bottom safe-area padding and fix overflow/min-width constraints.

Effect: fewer unnecessary requests, no clipped final rows/actions, and immediate payment visibility from canonical postings.

### Phase G — isolated sandbox

- Expose sandbox-only consumer creation, inquiry, payment, list, and reset endpoints only when `APP_ENVIRONMENT=sandbox`.
- Require sandbox-scoped API keys and a dedicated sandbox database guard.
- Build an organization sandbox console with endpoint explanations, JSON request/response examples, disposable consumer management, and test history.
- Add a mutually authenticated internal tenant purge endpoint to the sandbox runtime.
- During production activation, revoke/purge sandbox state before enabling live financial writes; close the sandbox UI once live.

Effect: client testing cannot affect production, and stale test keys become useless after activation.

### Phase H — verification and documentation

- Unit tests: PIN validation, encryption/decryption, legacy key behavior, never-expiry precedence, lifecycle policies.
- Disposable-MySQL integration tests: testing/live write gates, activation, reveal/rotate/offboard audit, tenant isolation, SSE tenant scope, sandbox purge, canonical posting invariants.
- Browser tests: admin credential modals, activation, school/org testing banners, blocked invoice attempts, no tenant manual-payment action, org API docs, payments form, sandbox closure, layout/search behavior.
- Static checks: TypeScript, production build, lint, backend syntax, dependency audit.
- Capacity checks: pagination limits and representative 2,000+ row pages; no unbounded dashboard query.
- Update handover, deployment variables, onboarding runbook, rollback steps, and decision/audit evidence.

## 6. Acceptance criteria

- A testing school or organization can create allowed master/test configuration data but receives the same lifecycle error from every production invoice/payment creation route.
- A live tenant can create production invoices/payment requests; a suspended live tenant cannot.
- Tenant users have no manual record/reverse payment endpoint or UI action.
- Admin reveal/rotate/offboard/activate requires a valid six-digit PIN and is audited; secrets never appear in logs or ordinary profile/list payloads.
- `customer_name` is required and `never_expires` always overrides expiry input.
- Org API documentation contains no bank-facing 1LINK endpoints and documents limit 1–30.
- Real-time pages perform no timed data refresh; committed payment events trigger tenant-scoped updates.
- Sandbox uses a different database/runtime/key namespace, cannot access production 1LINK, and is purged/revoked before activation completes.
- Existing production financial history and consumer numbers are never physically deleted by offboarding/suspension.
- All automated suites and a manual browser walkthrough pass, with remaining infrastructure/external 1LINK gates explicitly recorded.

## 7. Deployment gates outside application code

- Provision sandbox hostname, TLS certificate, isolated database/user, runtime, secrets, monitoring, and network policy.
- Configure `ADMIN_ACTION_PIN` and `API_KEY_ENCRYPTION_KEY` through the production secret manager; never commit them.
- Configure the mutually authenticated production-to-sandbox purge channel.
- Rehearse migration/rollback and encrypted-key backup restoration on a production-like copy.
- Obtain 1LINK VPN response/whitelisting and complete UAT. Application changes cannot make an unresponsive IKE peer establish a tunnel.

