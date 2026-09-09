# Fintap full local application QA audit

Prepared: 9 September 2026  
Repository: `D:\Projects\billing-brilliance`  
Audit target: local code and isolated XAMPP databases only

## Executive result

The current local build is a viable release candidate: every accessible admin, school, and organization route was opened in a real browser; the critical dialogs and navigation states were exercised; 1BILL inquiry/payment/duplicate/suspension behavior was exercised against MySQL; the 2,000-plus-student case was measured and manually verified; and all build, type, lint, unit, integration, and dependency gates pass.

The audit found concrete defects and corrected them. The fixes are listed below. No known application-breaking error remains in the workflows exercised by this audit.

This is not a claim that software can be proven to contain zero bugs. It is also not final production certification. Deployment still requires a production-database rehearsal, restore/load evidence, isolated sandbox infrastructure, and joint VPN/UAT completion with 1LINK. Those are external or operational release gates, not failures of the locally tested application.

No production VM, Nginx, StrongSwan, certificate, firewall, production database, or established VPN address was changed.

## Test environment

| Component | Audited configuration |
|---|---|
| Frontend | Vite at `http://127.0.0.1:8080` |
| Backend | Express at `http://127.0.0.1:3000` |
| Database | XAMPP MySQL at `127.0.0.1:3306` |
| Main QA database | `Fintap_local_qa` |
| Clean seed rehearsal | `Fintap_seed_audit_20260909` |
| Browser | Codex in-app browser, title `Fintap` |
| Runtime mode | development/testing only; HTTPS disabled locally |

The pre-existing local `payniva` database was not modified. Disposable QA credentials were supplied only through the local runtime and are not recorded in this document.

## Manual browser coverage

### Platform administration

The following routes loaded with their expected headings and live database content:

- `/admin`
- `/admin/billers`
- `/admin/users`
- `/admin/transactions`
- `/admin/verify-payment`
- `/admin/cashflow`
- `/admin/reports`
- `/admin/audit`

The sidebar was collapsed and expanded. Navigation labels and controls remained usable in both states.

The following high-risk controls were opened and inspected without executing destructive actions:

- create/edit biller modal, including 14- and 24-digit consumer-number policies;
- suspend biller modal with a required reason;
- production activation modal with five checklist items and exact-name confirmation;
- offboarding modal available only for a suspended biller, with reason and exact-name confirmation;
- user creation/import flows.

The final offboarding/delete action was deliberately cancelled. An interface audit does not justify deleting data.

### School portal

The following routes loaded successfully:

- `/school`
- `/school/students`
- `/school/fee-plans`
- `/school/fee-ledger`
- `/school/scholarships`
- `/school/billing`
- `/school/invoices`
- `/school/defaulters`
- `/school/payments`
- `/school/realtime-payments`
- `/school/payment-programs`
- `/school/reports`
- `/school/login-activity`
- `/school/settings`

The Record payment dialog was opened from an invoice. It displayed the exact payable amount, external reference, reason, consumer confirmation, and a disabled submit action until confirmation. No browser-driven payment was posted because a financial action requires explicit confirmation; the same posting behavior was verified at service/API level.

### Organization portal

The following routes loaded successfully:

- `/org`
- `/org/payments`
- `/org/history`
- `/org/realtime-payments`
- `/org/invoices`
- `/org/reports`
- `/org/sandbox`
- `/org/api-integration`
- `/org/login-activity`
- `/org/settings`
- `/org/webhook-config`

Legacy links `/org/api-reference` and `/org/reference` redirect to the working API integration reference. The reference displays authentication, request JSON, response JSON, errors, and examples. Organization settings expose only the server-provided API-key prefix; the full secret is neither embedded in the frontend nor stored in browser persistence.

The sandbox page correctly describes and links to a separate environment rather than simulating writes in production. Webhook testing remains disabled until a URL is configured.

### Role boundaries

An organization user attempting to navigate to `/admin` or `/school` was redirected to `/org`. Role-specific navigation remained isolated. Backend authorization and tenant-boundary tests also pass.

## Scale verification

The isolated QA database was expanded to 2,125 school students, including 2,100 synthetic scale records.

| Check | Result |
|---|---:|
| First page, 25 rows | 53.6 ms |
| Page 85, 25 rows | 75.8 ms |
| Exact-name search | 29.8 ms |
| Browser first-page size | 25 rows |
| Browser final page | `2101–2125 of 2125`, page `85 of 85` |
| Exact browser search | one matching record |
| Dashboard live count | 2,125 |

The browser does not attempt to render all students at once. Filtering and pagination are server-side. First, previous, next, and last controls now have accessible names, as do the per-student ledger, edit, and delete actions.

This validates the requested 2,000-plus-student view on the local dataset. It is not a substitute for a production-like concurrent load test across 100 tenants.

## 1BILL and payment verification

Two disposable organization payment requests were created in QA and processed through the real local 1BILL endpoints.

| Scenario | Verified response |
|---|---|
| Bill inquiry before payment | `response_Code=00`, `bill_status=U` |
| Exact BillPayment | `response_Code=00` |
| Exact replay of the same four-field transaction key | `response_Code=03` |
| Inquiry while owning biller is suspended | `response_Code=01`, `bill_status=B` |
| Inquiry after restoring biller | `response_Code=00`, `bill_status=P` |

Both successful payments have matching payment allocations. The organization payment history, real-time page, invoice page, and reports all displayed the resulting records and totals.

The 1BILL replay defect discovered during this test was fixed: duplicate detection now runs before a target-status filter can hide an already-paid request, and an already-paid target is allowed to reach the canonical payment service so it returns the correct response rather than behaving like a missing bill.

The application-side test does not establish the production IPsec tunnel. The known external state remains that IKEv2 packets leave `178.238.236.126` for peer `103.248.140.4`, but no peer response has been received.

## Defects found and fixed during this audit

| Defect | Fix | Reason |
|---|---|---|
| Browser metadata still identified the product as Payniva | Updated title, description, author, and social metadata to Fintap | Prevents stale branding and misleading browser/share information |
| Organization frontend contained a hard-coded development API key and persisted key state in local storage | Removed the secret and API-key setters from browser state; UI now receives only a masked server prefix | Full API secrets must be one-time values and must not be embedded in shipped JavaScript |
| Several dialogs had no accessible description | Added dialog descriptions to biller, user, invoice, payment, student, scholarship, fee-plan, payment-program, session, and command dialogs | Screen readers need the purpose and consequence of high-risk actions |
| 1BILL duplicate payment replay was not rejected after the first payment changed target status | Added early four-field duplicate lookup and preserved paid-target detection | Gateway retries must be idempotent and must never double post |
| Local reverse-proxy testing produced forwarded-IP warnings and could not exercise source-IP rules cleanly | Added bounded `TRUST_PROXY_HOPS`, defaulting to one hop only in production | Preserves real client-IP checks without trusting arbitrary proxy chains |
| Organization invoice and real-time screens omitted bill IDs/due dates and missed recent payment rows | Added the required fields to the organization payment query | The UI cannot reconcile or display values the API does not return |
| Large-table pagination and row actions were icon-only | Added accessible labels and titles | Makes the 85-page student table operable without guessing icon meaning |
| Deployments could inherit predictable 1LINK credential/prefix defaults | Removed runtime fallbacks and retained fail-closed production guards | Missing external credentials must stop a production boot rather than silently selecting demo values |
| Seed data invented paid invoices/completed transactions without canonical payment evidence | Seed now creates only unpaid invoice and transaction-attempt fixtures | “Paid” is an accounting event, not a decorative sample status |
| A second seed run could use newly generated IDs instead of persisted tenant/user IDs | Seed now resolves stored IDs and was run twice successfully | Repeatable QA provisioning should not fail foreign keys or multiply fixture rows |

## Automated gates

| Gate | Result |
|---|---|
| Frontend production build | passed; 2,359 modules |
| TypeScript `tsc --noEmit` | passed |
| Frontend ESLint | zero errors; seven existing Fast Refresh warnings in shared UI primitives |
| Frontend Vitest | 1/1 passed |
| Backend ESLint | passed |
| Backend Jest unit tests | 24/24 passed across six suites |
| Backend public + authenticated MySQL integration tests | 7/7 passed after the admin-verification addition |
| Admin payment browser E2E | passed in Chromium |
| Frontend production dependency audit | zero known vulnerabilities |
| Backend production dependency audit | zero known vulnerabilities |
| `git diff --check` | passed |
| Missing-production-credential boot test | failed closed as required |
| Fresh migration + seed | passed |
| Second seed against same database | passed with stable counts |

The seven frontend lint warnings are development hot-reload guidance, not production build or runtime errors. They are confined to shared UI component files that intentionally export component variants/helpers.

## Database observations

- The two canonical QA 1BILL payments have exact allocation totals.
- No tenant stores a plaintext API key in `tenants.api_key`.
- All generated consumer identifiers use a supported 14-, preserved 20-, or new 24-digit length.
- Reuse of a consumer number between an applicant and its own organization payment record is intentional linkage, not a collision.
- The main scale database retains older seed rows created before the seed correction. The separate clean-seed database proves the corrected fixture behavior without deleting audit evidence.

## Remaining production release gates

1. Back up production and rehearse migration `007_production_foundation.js` against a recent restored copy of the real `Fintap` database. Run reconciliation queries before and after.
2. Perform a documented database restore drill. A backup that has never been restored is not adequate evidence.
3. Provision the sandbox as a separate hostname, process, database user/database, credentials, certificate, logs, and network boundary; set `VITE_SANDBOX_BASE_URL`. It must have no production 1LINK VPN route.
4. Start and monitor the durable outbox worker in the production PM2 configuration; prove retry and exhausted-attempt alert behavior.
5. Run concurrent production-like load tests across representative tenant, payment, report, and student-list workloads. Record p95/p99 latency, error rate, DB lock waits, CPU, and memory.
6. Have 1LINK whitelist/activate public peer `178.238.236.126`, return IKEv2 traffic, and complete joint inquiry/payment/duplicate/paid/blocked/after-due-date UAT over the real tunnel.
7. Obtain written 1LINK confirmation that FetchBundle is outside the contracted invoice-service scope and that the requested 24-digit consumer identifier is accepted.
8. Confirm production certificate chain, TLS/cipher requirement, final web-service credentials, SFTP access, settlement/report operations, monitoring, alert contacts, and change window with 1LINK.

## Release decision

**Local application QA: pass.**  
**Ready for controlled staging/UAT deployment: yes.**  
**Ready for an unqualified production go-live today: no, pending the eight gates above.**

That distinction protects financial integrity. The code path tested here is working; production readiness also depends on recoverability, measured capacity, environment separation, and the external 1LINK connection.
