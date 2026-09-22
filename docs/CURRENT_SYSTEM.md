# Current system contract

Updated 23 September 2026. This describes the code in this repository, not a certification of a deployed environment.

## Architecture

`src/` is the React application; `server/src/index.js` hosts the Express API; `server/src/workers/outboxWorker.js` runs separately. Both use the same environment-selected MySQL database. The static marketing site under `website/` has its own identity and publication process.

All financial writers acquire the tenant lock before student, invoice, or payment locks. `invoiceAccountingService` writes invoices, ledger debits, and cached student balances together. `paymentPostingService` writes payment evidence, allocations, transactions, ledger effects, audit records, and outbox events in one transaction. An unpaid invoice cancellation creates a compensating ledger credit; paid invoices require a verified reversal. Historical invoices without identifiable charge evidence are rejected for automatic cancellation and require reconciliation.

Production school/organization dashboard accounts cannot mark funds received. Platform administrators can record verified manual receipts with a reason. Provider adapters validate their configured credentials/signatures before canonical posting. The SaaS payment simulator is sandbox-only. A simulator source cannot bypass production tenant activation.

Tenant API keys are checked centrally for scope, lifecycle and source IP. Production API-key calls fail closed when no allowlist is configured. JWT dashboard requests use user and tenant authorization; they do not use the server integration IP allowlist. Recoverable API keys are encrypted and may be revealed or rotated only through the authorized PIN-gated administrative flow. Preserve the encryption key in the secret backup.

## Financial conventions

- Amounts are PKR rounded to two decimal places. Posting requires the exact payable amount.
- Stored timestamps and reporting boundaries are UTC. Local date/time controls are populated in local time and converted once on submission.
- A due date remains current through the end of that UTC day. The shared payable calculation adds unapplied late fees after that boundary.
- Recurrence is anchored to the assignment's first due date. Monthly, quarterly, yearly and one-time assignments are eligible only in their billing periods. Inactive students are excluded.
- Scholarships must be active, their assignment must be effective, and their validity must include the billing month's first day. Discounts are capped at tuition; additional fees are not discounted.
- Manual and assignment-created invoices have identifiable ledger charge references. Transport is charged once per eligible month.
- Dashboard totals are database aggregates, independent of display pagination. Signed reversal entries offset the original receipt. Exports explicitly contain the displayed rows.
- Existing historical discrepancies are not silently rewritten. Run the read-only reconciliation report and review corrections with financial evidence.

## Sessions and live updates

Access and refresh tokens contain a user authentication version. Password replacement increments that version and revokes refresh sessions atomically. Refresh tokens have random identifiers and are single-use; rotation occurs inside a transaction. Password changes sign the user out.

Payment streams require authenticated users, re-check authorization periodically, and close at token expiry or five minutes. The browser refreshes credentials when necessary and reloads authoritative data on reconnect. Payment events are process-local: keep one API process until a shared event transport is implemented. Do not increase PM2 instances without addressing this constraint.

## Operational health

`GET /api/health` is liveness. `GET /api/ready` checks database access and, in production, a recent outbox-worker heartbeat, and reports the staged release revision. The worker periodically expires still-pending organization requests, claims outbox entries with row locks, retries delivery, and records failed or skipped deliveries. Monitor terminal failures and skipped events; see the webhook guide.

Migrations are additive and checksummed. Never edit a migration already applied to a database. Both legacy and current organization tables existing simultaneously require deliberate reconciliation before migration proceeds. The legacy role conversion widens ENUM values before converting them.

## Documentation precedence

Use this document, README, WEBHOOKS, CI_CD and the production deployment runbook for current behavior. Dated network investigations and handovers remain evidence of the stated dates. Reconfirm provider-assigned addresses, credential format, accepted consumer-number lengths, and reversal/correction procedures with the provider; do not copy old selector/IP values into production based solely on repository history.
