# Production hardening — 23 September 2026

Branch: `codex/production-hardening`. Starting revision: `adb48df`.

**Status:** repository fixes and local regression verification completed. This is a release candidate, not a certification of the live service. No production database, provider payment, VPN configuration, deployment or external webhook receiver was modified during this work.

## Changes mapped to the review

| Review finding | Implemented response |
|---|---|
| 1. Tenant self-reported payments | Legacy billing posting now requires platform-admin verification; SaaS simulation is sandbox-only. |
| 2. Paid invoices reopened | Settled status is immutable outside the reversal workflow, including concurrent state-change protection. |
| 3. Invoice/ledger disagreement | Shared transaction creates invoice, charge and cached balance together. Cancellation writes a compensating credit. Missing historical charge evidence requires reconciliation. |
| 4. Partial assignment writes | Individual and bulk immediate assignments join invoice/ledger creation in the same transaction and tenant lock. |
| 5. Testing tenant charges | Lifecycle is enforced inside financial transactions, including assignment, registration, additional charges and simulator posting. |
| 6. Recurring eligibility | Monthly/quarterly/yearly/one-time periods honor start/anchor dates and active students; duplicate generation is skipped. Transport billing also works without a tuition assignment. |
| 7. Scholarship eligibility | Inactive scholarships and future-effective assignments no longer reduce current invoices. |
| 8. Inquiry/payment disagreement | Shared payable and late-fee rules are used by billing, manual verification, 1LINK and canonical payment posting. Inconsistent historical debt is blocked for financial review. |
| 9. Expiry overwrites payment | Expiry updates are conditional on still-pending state and authoritative state is re-read. Worker performs periodic conditional expiry sweeps. |
| 10. IP allowlist gaps | Tenant API-key policy is centralized and applied to lists, notifications and SaaS routes. |
| 11. Unsafe webhook transport | Real and test delivery use public-HTTPS validation with pinned DNS, no redirects and bounded timeout. |
| 12. Password reset sessions | Credential changes increment authentication version and revoke refresh sessions atomically. Existing access sessions are rejected. |
| 13. Token collision/rotation | Random token identifiers prevent same-second collision; locked single-use refresh rotation commits atomically. Browser tabs coordinate rotation where Web Locks is supported. |
| 14. Unsafe resets | Seed/reset/fresh require a non-production disposable database name plus exact confirmation; all use central environment selection. |
| 15. Untested/partial deployment | CI transmits the tested SHA; new script stages releases, checks readiness/revision/worker, tracks success separately and rolls back the application symlink on activation failure. Host layout provisioning is required. |
| 16. Broken student selectors | Valid page limits, server search, page controls and visible errors; class choices derive from student facets. |
| 17. Truncated reporting | Admin dashboard/cash-flow/reports use database aggregates; tenant/transaction/ledger tables paginate; daily totals are server-calculated; exports identify displayed rows. |
| 18. Request races/errors | Shared queries ignore stale success/failure responses. Administrative list operations handle rejection and settle loading; audit and ledger views expose failures. |
| 19. Live-feed reconnects | Refresh authentication on reconnect, catch up from the API, invalidate organization statistics, close expired/revoked streams. Single API process remains required. |
| 20. Local payment timestamps | Local input values round-trip to UTC without shifting by the local offset. |
| 21. School user passwords | Scoped sub-user password/profile changes commit together; resets invalidate sessions; self-service password changes sign out. |
| 22. PDF/CSV/import behavior | Real PDF generation, properly quoted CSV with spreadsheet formula escaping, CSV-only student imports and failed-row reporting. |
| 23. Duplicate organization history | Listing selects the current posted, non-reversal payment deterministically. |
| 24. Legacy migrations | Rename legacy tables before schema creation; explicit conflict stop when both tables exist; ENUM conversion widens before updating values. |
| 25. Missing quality gates | Type-check is part of production build. Added frontend, transaction/concurrency, deployment-failure, webhook, reset and browser regression checks; CI includes MySQL/browser jobs. |
| 26. Conflicting documentation | New README/current contract, rewritten webhook/deployment/CI guides, current in-app webhook examples, and historical banners on superseded guides. |
| 27. Dead marketing form | Replaced the nonfunctional form with a clearly labelled email-draft action. Placeholder policy links request documents by email. Actual policies, mailbox ownership, brand and provider claims still need business approval before publishing. |
| 28. External provider readiness | Explicit launch gates documented. Real 1LINK/network/settlement/backup evidence cannot be established with local tests. |

Additional protections include ledger-controlled student balances (profile edits cannot alter money), chronological ledger display balances computed from signed entries, a read-only reconciliation command, versioned outbound events, explicit skipped deliveries, worker heartbeat monitoring, and removal of unused mock scheduler state.

## Verification evidence

All financial testing used a newly initialized local MySQL 8.4 instance bound to loopback on a dedicated port, with databases named `fintap_test_hardening` and `fintap_test_legacy_hardening`. The configured application database was not used.

- Frontend TypeScript: passed application and tooling projects.
- Production frontend build: passed.
- Frontend tests: 6 passed, covering request races, current/stale errors, CSV quoting/formula escaping, malformed CSV and local-time round-trip (Asia/Karachi).
- Backend unit tests: 63 passed across 18 suites. Includes real deployment-script control flow with controlled command stand-ins: exact revision validation, failed build, failed migration, successful activation and readiness-failure rollback. These are not a live Linux/PM2 rehearsal.
- MySQL regression tests: 15 passed. Includes eight simultaneous duplicate payment attempts producing exactly one accounting bundle; injected audit and charge failures; cancellation/reversal; lifecycle gates; quarterly billing/scholarships; same-second login and concurrent refresh; password revocation; totals beyond 100 invoices; organization reversal/repayment listing; integration allowlists; legacy accounting protection; balance-edit prevention; transport-only billing.
- Browser checks in Chromium: three targeted workflows passed (55-student selection/search, genuine PDF and current-page CSV downloads, visible data-service errors); one route sweep passed across all admin/school/organization portals with no unexpected 4xx/5xx responses or browser errors.
- Fresh migration and repeat migration: passed on the disposable database. Synthetic legacy table/ENUM conversion passed and preserved fixture rows. This does not replace a restored-production-backup rehearsal.
- Worker started locally and heartbeat freshness was verified. Signed delivery behavior is covered with a controlled receiver/transport substitute; no live external endpoint was contacted.
- Read-only reconciliation command ran successfully against the disposable database. Zero findings there do not establish integrity of production data.
- Frontend and backend production dependency audits: zero known vulnerabilities reported at verification time.
- Lint: zero errors; seven pre-existing Fast Refresh export warnings in shared UI components.

Local runtime was Node 24; CI is configured for Node 22. CI has been updated but has not been run remotely in this task. Provider-specific and sandbox E2E suites requiring external/separate environments were not represented as passing.

## Release instructions and limitations

1. Apply migrations **012–014** through the normal migration runner on a restored staging copy first. Do not modify existing migration checksums. Before launch, run `npm run reconcile --prefix server` using the explicit environment file and review historical differences. It reports evidence without rewriting money.
2. Provision the new release/symlink/shared-environment layout before enabling the updated deploy script. It refuses the old layout. Rehearse it with the actual Linux/PM2/Nginx setup and verify forward migration compatibility with the previous release.
3. Confirm real provider UAT, authoritative network/identifier contract, production credentials/allowlists, TLS, operational alerting, settlement reconciliation, and an off-host backup restore. See [the release runbook](PRODUCTION_DEPLOYMENT_RUNBOOK.md).
4. Keep a single API instance until the event bus is shared. Worker retries are finite; exhausted or skipped events require reviewed operator replay. Automated discrepancy correction and self-service outbox replay are not implemented.
5. CSV imports can partially succeed across individual student requests; the UI identifies failed rows and instructs retrying only those rows. Exports cover displayed rows. PDF's bundled standard fonts are intended for Latin text; dedicated Urdu/non-Latin typography needs an embedded font workflow before promising multilingual PDF output.
6. Publishing the marketing site still requires approved legal/commercial documents, verified contact mailbox, branding and integration claims. No fabricated policy or provider certification was added.

The workspace contains the implementation and tests; it has not been pushed, merged or deployed. The changes should proceed through the documented staging and launch gates.
