# Production billing-flow corrections — 9 October 2026

These changes address the ordinary dashboard/API creation gaps found after provider UAT. They do not recreate test consumers or alter existing paid history. The user reports UAT complete; this release's automated tests are not a new provider-origin acceptance test.

## Application changes

- School integration status checks aggregate all outstanding invoices, ledger balance and applicable late fees. A newer paid invoice cannot hide older debt. Unbilled consumers return `no_invoices`/`paid:false`; 1BILL inquiry/payment return `01` until there is a bill. Actual paid bills retain `06/P`.
- Organization requests and manual school invoices accept `lateFee` (organization also accepts `late_fee`). Both dashboards expose it. Immediate fee-plan assignments preserve the plan's late fee. Amounts must be positive PKR with at most two decimal places; late fees may be zero. Amount-plus-fee and aggregate school consumer debt cannot exceed PKR 9,999,999,999.99 (the N12 payment amount in paisa).
- A late fee applies once, after the due date's calendar day ends in Pakistan (UTC+05:00), using shared inquiry/posting rules. Paid organization records preserve the actual collected amount separately from the original base amount; paid inquiries, history and collection totals include the collected fee, without adding fees after payment.
- `neverExpires:true` remains authoritative and permits payment after the due date, including an applicable fee. Otherwise an explicit due date supplies expiry at its Pakistan day-end when `expireAt` is omitted. With neither date nor expiry, the existing 48-hour default remains. Explicit expiry must be a valid future timestamp with timezone, on or after the due date in Pakistan. To collect late fees, choose Never expires or an expiry after the due date.
- Organization creation requires an active, non-deleted posting belonging to the same tenant, even with a supplied description. Create/activate a posting first; the form offers an active-posting selector. Reusing an existing application ID returns the original request/consumer; it does not create or alter a second bill.
- Organization inquiry displays `customer_name`, retaining the existing 30-character `consumer_Detail` contract. All other agreed provider casing, padding, prefix handling, blocked/invalid/duplicate and amount-mismatch codes remain covered by regression tests.
- The unused applicant-only creation endpoint returns HTTP 410 (`APPLICANT_CREATION_RETIRED`) and directs integrations to `/api/payments/create`. Existing applicant records remain readable. No new uncollectible applicant-only numbers are issued.
- Production payment reversal is disabled (`REVERSALS_DISABLED`), including manual reversals, in accordance with the owner's policy. Disposable development/sandbox reversal tests remain supported. No UAT reversal/reset script is made available as a production feature.

## Schema and release

Migration 015 adds organization `late_fee` (default zero) and nullable `paid_amount`; old paid records fall back to their original amount. Migration 016 widens school invoice/plan late-fee decimal storage without altering values. Both migrations preserve existing data and are structurally compatible with the previous application. However, old application code does not collect new organization late fees correctly: after issuing bills with nonzero fees, prefer a forward fix; any rollback must first prevent incorrect collection of those bills. Existing expiry values and UAT states are not rewritten. Runtime migration readiness prevents starting this code without its required schema.

## Verification

- Local verification passed: 126 backend unit tests, 43 database integration tests, 8 frontend tests, production build/typecheck, and lint (seven existing frontend fast-refresh warnings, zero errors). CI repeats required release gates.
- New integration scenarios use normal student, invoice, posting activation and payment-request endpoints, then inquiry/payment through the provider API. They verify full/short numbers, customer name, late-fee collection, exact amount rejection, duplicate protection, no-bill state, older outstanding bills, posting ownership/status, money limits and legacy endpoint retirement.
- Browser regressions cover both new late-fee forms, never-expiring overdue organization requests, student selectors, exports and visible request failures. CI now runs these five disposable-environment journeys.
- Encrypted backup tooling was exercised against a disposable database: backup, authenticated verification, restore into an empty independent test database, seven financial table-count comparisons, and rejection of a tampered archive. This is not a production disaster-recovery drill. See [backup procedure](BACKUP_AND_RECOVERY.md).
- An exploratory full browser-suite invocation also selected older admin scenarios requiring separately configured admin credentials; those did not run successfully in this fixture environment. The supported five-scenario CI suite passed after isolating the new test's database pool. Do not count the admin scenarios as verified by this release.

## Remaining launch responsibilities

1. **Off-server recovery:** no independent storage destination exists yet. Choose one, preserve encryption/configuration keys separately, schedule and monitor transfers, and rehearse restoring a real production backup. The new tool/runbook is not a running backup service.
2. **Client notifications:** tenant 1002 had no external notification URL at audit time. Poll the authenticated status API until a real destination is configured and its signed callback delivery is tested. A healthy worker is not evidence of an external delivery.
3. **UAT history:** retain existing test payment evidence. Agree isolation/retirement and distinguish it from real revenue before client onboarding; do not clear paid records or reuse numbers.
4. **Go-live ownership:** confirm written provider approval, settlement/reconciliation handling, monitoring, incident support and launch date. Local checks do not prove fresh traffic from both 1BILL VPN sources.

A fresh encrypted pre-deployment production database dump was saved and authenticated under `/var/backups/fintap/20261009-production-flows/`. This is a same-server safety copy, not off-server recovery. Deployment revision and live read-only verification will be recorded after the release completes.
