# Bill-specific numbers and optional installments — 23 October 2026

## Product behavior

School and university profiles retain a stable internal student ID. New institutions use bill-specific payment numbers: `105172` + four-digit institution code + seven-digit monotonically allocated sequence (17 digits). A student registration without a bill returns no payment consumer number. Every invoice, including monthly-generated and one-time charges, receives its own number. Organizations continue their existing per-payment-request model; new requests can use 17 digits.

Capacity is 9,999,999 issued numbers per institution. Cancelled or replaced numbers remain reserved permanently. Splitting consumes one original number plus a number for each child. At 10,000 students, one monthly fee split into four installments consumes at most 600,000 numbers/year including originals; eight years uses 4.8 million. No sequence reset is permitted. The policy screen reports remaining capacity and warns at 20% remaining. This is capacity arithmetic, not a throughput benchmark.

Installments are optional and disabled by default. An institution administrator enables them on Invoices. Finance/admin can split an unpaid original bill into 2–60 dated installments. The amounts must sum exactly to the original base amount in paisa; each installment has an explicit late fee. Saving atomically retires the original bill and replaces its ledger charge with the child charges. Original consumer inquiries/payments become invalid. Each child accepts exactly its current payable amount, independently of other student debt. Disabling new plans does not invalidate existing bills. Paid bills and already-split children cannot be split. This implements fixed installments, not arbitrary short payments or the provider's partial-payment T status.

The invoice list includes a copyable, printable fee slip for each bill. The QR contains only the consumer number as a convenience; it is not a certified bank-app payment QR. Monthly generation retains fee-plan/month lineage and does not duplicate transport charges after a split.

## Compatibility and security

Existing institutions default to legacy mode during migration, preserving historical 14/20/24-digit consumers. The explicit production cleanup switches the verified UAT school to invoice mode/17 digits and the organization to 17 digits without resetting counters. Never flip an institution with real unpaid legacy invoices without a reviewed migration plan.

1BILL accepts either the full consumer or its suffix after the six-digit prefix; both resolve to the same invoice and replay identity. Response keys remain case-sensitive (`consumer_Detail`); absent dates/amount/auth fields retain the established fixed space widths. Inquiry uses 00/U for unpaid, 06/P for paid, 02/B for blocked, 01/blank for missing or retired. Payment retains 02 for blocked or incorrect/zero amounts, 03 for duplicate, 06 for already paid. No automatic external payment reversal was added.

Tenant and target locks serialize financial changes. Generated invoice consumer uniqueness plus the permanent reservation table prevents reuse across writers. Cross-tenant operations fail; legacy student consumers cannot settle new bill-specific invoices. Payment, split, cancellation and failures maintain ledger consistency. The migration is additive except making student consumer numbers nullable. New tables explicitly match the existing utf8mb4_unicode_ci collation.

## Integration API additions

Authentication remains the institution's `X-API-Key`; 1BILL provider credentials are separate.

- `POST /api/saas/v1/register-consumer`: stable student profile, optional first invoice; response includes `consumerId`, and the new bill consumer if an invoice is supplied. A repeat externalRef returns the existing profile and its bills.
- `POST /api/saas/v1/bills`: body `{studentId, amount, dueDate, month?, lateFee?}`; mandatory `X-Idempotency-Key` (1–100 characters). Same key/body returns the same invoice; changed body returns 409. Use a new key for a genuinely new bill.
- `POST /api/saas/v1/bills/:id/installments`: `{installments:[{amount,dueDate,lateFee},...]}`; institution must have enabled installments. Same original/plan retry returns existing children; conflicting plan returns 409.
- Existing check-payment, bill-status and payment-history now target the exact bill. Internal student IDs never replace bill consumers in bank requests.

Amounts are PKR decimals with at most two fractional digits. Consumer numbers must stay strings, not JavaScript/Excel numeric values. A replaced/cancelled number is never reused or retargeted.

## Verification

Meaningful regression checks cover unique concurrent allocation; payment/split races; exact sums; rollback after an injected ledger failure; blocked, paid and duplicate provider responses; due-date fees; cross-tenant rejection; repeated external requests; retired-number reservations; monthly and transport generation; and browser creation/splitting/fee-slip presentation. Existing legacy and organization regression suites are retained. CI runs these on disposable MySQL plus Chromium before deployment.

The production backup was encrypted, copied off-server into the operator workspace, restored to an empty disposable local database, migrated, and reconciled. Cleanup was rehearsed there before applying it live. This is a verified manual recovery point, not scheduled off-server backups or high availability.

## Production network and provider dependency

Public endpoint: 178.238.236.126. Protected local endpoint: 172.31.254.10/32. VPN peer: 103.248.140.4. These remain unchanged.

Added protected remote sources: 10.95.4.224/32 and 10.95.4.225/32. HTTPS on the private endpoint is restricted to IPsec traffic from these and existing UAT sources 10.95.8.92/32 and 10.95.8.94/32. The narrow firewall does not change public-site or SSH rules. Its systemd service persists after reboot. Remove UAT access after the provider confirms production cutover.

On 23 October the peer explicitly rejected both production CHILD_SA proposals with TS_UNACCEPTABLE. The existing IKE/UAT tunnel remained established. Our configuration is ready; production connectivity requires matching selectors and routing at 1BILL. Do not claim their end-to-end production path is tested. The 17-digit format is within the supplied document's 20/24-digit maxima, but acceptance of the new full/suffix length and bill-specific model still needs a provider smoke test before collecting real funds.

The handover certificate ZIP contains the currently served Sectigo app.fintap.pk certificate and its two CA-chain certificates, DER `.cer` format, plus a README. Leaf expiry is 10 April 2027. Public TLS 1.2 and certificate verification passed. The ZIP has no private key or credentials. New provider credentials are delivered separately in a protected local handover file; no email is sent by this task.

Deployment checks also required updating the optional jsPDF DOMPurify dependency from 3.4.16 to 3.4.17, the patched release for [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7). The existing API-key tampering test now flips a real ciphertext byte, avoiding intermittent no-op base64 character mutations. Production dependency audits are checked again before deployment.
