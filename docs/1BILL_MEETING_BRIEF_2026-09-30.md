# 1BILL meeting brief — 30 September 2026

Prepared 29 September 2026, approximately 02:27–02:30 PKT. Internal reference for rapid answers; contains no credentials or customer identities. Tomorrow's meeting date follows the user's message and current Pakistan date. Recheck time-sensitive values before executing UAT.

**Correction at approximately 02:35 PKT:** The user supplied the actual email sent to 1BILL. Its consumer list is different from the 7 September CSV. All 20 emailed identifiers exist in production. The earlier inference that a replacement pack was needed because all numbers were absent was wrong. The actual issues are an expired 24-digit case and incomplete authorization metadata on two manually paid fixtures. Use the corrected evidence below.

**Latest status, 29 September:** At the user's request, the existing 24-digit case was reopened at the same PKR 6,000,000 amount. It now returns `00/U` and remains valid through **31 October 2026, 23:59:59 PKT**. Its due date is 31 October. The expired results below are the historical diagnosis before this correction. Paid-fixture authorization metadata remains unresolved.

## Confirmed update

The user reports that 1BILL has accepted the Sectigo SSL certificate. Treat certificate acceptance as complete. This is not evidence of successful Inquiry, Payment, settlement, or final production certification. The provider acceptance email was not independently retrieved during this preparation.

## System and connection facts

| Question | Answer / evidence |
| --- | --- |
| What is Fintap's role? | Zynotch PVT Limited aggregator, invoice-based collection; assigned prefix recorded in the handover and runtime is `105172`. |
| Which hostname? | `app.fintap.pk`, HTTPS port 443. The apex `fintap.pk` is a different TLS endpoint. |
| Inquiry API? | `POST https://app.fintap.pk/api/1.0/Payments/BillInquiry` |
| Payment API? | `POST https://app.fintap.pk/api/1.0/Payments/BillPayment` |
| Authentication? | `username` and `password` headers plus production source-IP allowlist. Exchange credentials securely; do not paste them into meeting chat or screenshots. |
| VPN addresses? | Fintap public endpoint `178.238.236.126`, protected host `172.31.254.10/32`; real 1LINK peer `103.248.140.4`; protected provider hosts `10.95.8.92/32` and `10.95.8.94/32`. |
| VPN encryption? | Fresh observation: IKEv2, AES-256, SHA-256, DH19; both ESP CHILD SAs installed with PFS19. |
| Is it online? | Fresh production `/api/ready` returned HTTP 200, revision `5681e4f5d19648da891f19c774282f8756c81843`. |
| Has 1BILL called it successfully? | Not proven. Current installed SAs showed zero inbound protected packets. Counters reset on rekey and are not a lifetime traffic history. |
| Certificate? | Accepted according to user. Last verified live certificate: Sectigo Public Server Authentication CA DV R36; RSA 2048; SAN `app.fintap.pk`; expires 10 April 2027. Renewal/reissue is manual. |

## Consumer numbers and current test-data readiness

- Construction: six-digit fintech prefix + numeric tenant/biller code + zero-padded sequence, totaling the tenant's configured length. Treat consumer numbers as strings to preserve zeros and avoid numeric precision loss.
- Allocation supports 14, 20 and 24 digits. It locks the tenant row during allocation and checks the available sequence capacity. The code's fallback policy is 20 digits; existing tenant policies determine actual generation.
- Fresh production snapshot: 19 non-deleted school consumers, all 14 digits; one active/live tenant with a 14-digit policy and one active/live tenant with a 24-digit policy. The user's subsequently supplied email identifies these exact 19 school records plus one organization record as the UAT list already sent to 1BILL.
- The supplied generic specification permits up to 24 characters but separately says the 1LINK maximum is 20. Obtain an explicit answer for this integration's production maximum and its requested 24-digit UAT case. Do not promise universal 24-digit gateway acceptance.
- Historical UAT CSV: [7 September test sheet](1bill-connectivity/1BILL_UAT_CONSUMERS_2026-09-07.csv). Its 20 exact identifiers were checked in both current production and sandbox databases: none found. **This is a different list from the user's sent email and must not be used to assess that email's consumers.**
- Current organization record: the emailed 24-digit consumer exists with the correct PKR 6,000,000 amount but is expired. Production payment counts show two posted manual payments and no `onelink` payment rows. This does not establish what traffic may have reached the gateway previously.
- Requested UAT pack: 14 unpaid cases across seven amount slabs (two per slab), two paid, one after due date, two blocked, and one 24-digit consumer. The emailed list has the requested category counts. The reviewed local documents do not establish approved final slab boundaries; do not call the emailed amounts noncompliant without provider evidence.
- Do not run a Payment against an existing consumer just to demonstrate connectivity. Select approved synthetic records and record starting state, expected amount, response and accounting result.

### Exact emailed list: deployed Inquiry verification

Checked the deployed Inquiry controller against a read-only production database snapshot on 29 September at approximately 02:35 PKT. Invoked the controller locally, excluding response names from the output. This bypasses HTTP authentication and the VPN and is **not** a successful provider-origin API test. No Payment request or financial write was performed.

| Email cases / identifiers | Amount and current result | Assessment |
| --- | --- | --- |
| Cases 1–14; school suffixes `0001`–`0014` under `1051721001` | PKR 2,500; 4,999; 7,500; 10,000; 25,000; 100,000; 175,000; 250,000; 500,000; 1,000,000; 1,500,000; 2,500,000; 3,500,000; 5,000,000. Each returns `00/U`, matching its emailed amount; due 5 October 2026. | Matches emailed unpaid states and amounts. |
| Case 15; school suffix `0015` | `00/U`; PKR 5,500,000 before due date and PKR 5,500,500 after due date; due 20 September 2026. | Matches overdue amount plus PKR 500 fee. Overdue remains `U` in this interface. |
| Case 16; `105172100200000000000001` | Exactly 24 digits; PKR 6,000,000 exists; currently `expired`; Inquiry returns `01/B`. | Does not match emailed unpaid state. |
| Cases 17–18; school suffixes `0016`–`0017` | `00/P`; amount paid PKR 3,000 / 8,000; date paid 21 September 2026. Both return an empty `tran_auth_Id`. | Paid states and amounts match email; conditional six-digit authorization metadata is incomplete. |
| Cases 19–20; school suffixes `0018`–`0019` | Inactive consumers; corresponding invoices PKR 20,000 / 150,000; Inquiry returns `02/B`. | Matches blocked cases. Blocked responses intentionally do not quote payable amounts. |

The organization record was created at 21 September 19:54:45 UTC and expires at 23 September 19:54:45 UTC (24 September 00:54:45 PKT), exactly 48 hours later. Runtime default organization expiry is 48 hours. The worker periodically expires pending records, and Inquiry independently rejects records after expiry. This supports an elapsed UAT payment-request lifetime, not a missing or malformed consumer identifier.

The two paid school records are posted manual payments with NULL `voucher_number`. The Inquiry code only emits a six-digit numeric authorization identifier, explaining the blank field. Do not fabricate a real bank authorization ID. Prepare documented synthetic paid-case metadata or an agreed fixture workflow for UAT, preserving existing accounting evidence.

Completed bounded correction on 29 September: the user authorized restoring the emailed 24-digit case. A transaction locked its tenant and exact record, checked that its amount was PKR 6,000,000, state was expired, and no payment, allocation or transaction evidence existed. A root-only backup was saved at `/var/backups/fintap/uat24-20260929-p1Bibj/record-before.json`. The single request was changed to pending, due 31 October 2026 and expiring at 18:59:59 UTC that day (23:59:59 PKT). Audit ID: `bf8597ac-55af-4066-b3aa-af1da5a0631e`. Consumer identifier and amount were preserved. Deployed Inquiry verification before commit and an independent check after commit both returned `00/U`, with both amount fields `+0000600000000` and due date `20261031`. No payment was submitted; the target still has zero payment rows. Paid-fixture metadata and provider-origin Payment/replay tests remain pending.

## API answers to keep precise

- Inquiry requires `consumer_number` and `bank_mnemonic`; `reserved` is optional. Payment additionally requires `tran_auth_id` (six numeric digits), `transaction_amount` (12 digits in minor units), `tran_date` (YYYYMMDD), and `tran_time` (HHMMSS).
- Example amount encoding: PKR 120.00 is `000000012000` for Payment and `+0000000012000` for Inquiry. Inquiry names are padded to 30 characters.
- Duplicate identity is consumer + authorization ID + transaction date + transaction time. Replays return Payment code `03`; posting uses a database transaction, locking, uniqueness constraints, accounting evidence and an outbox event.
- Payment success is `00`, unknown consumer `01`, unknown failure `02`, duplicate `03`, invalid data/amount `04`, already paid `06`. The supplied specification also lists `05` for processing failure; the current controller's generic failure fallback is `02`.
- Inquiry normally returns `00` with `U` for unpaid or `P` for paid. Blocked school consumers return `02` and `B`. An overdue bill remains `U`; **`T` does not mean overdue** in the supplied specification (it denotes partial/multiple/excess payment).
- Payment must match the payable amount exactly. Late fees and expiry checks apply. The historical after-due organization test does not prove a school late-fee test.
- Fields to settle: `consumer_detail` vs sample `consumer_Detail`; `tran_auth_id` vs sample/implemented `tran_auth_Id`; Payment reserved maximum 400 vs 515; padding/serial-number expectations; HTTP statuses; timezone/cutoffs; accepted bank mnemonic; throughput and retry rules.
- Scope currently implements Inquiry and Payment. FetchBundle is excluded from the invoice-only implementation; obtain scope confirmation. Do not advertise an available FetchBundle endpoint based on the old handover.
- Sandbox bank-facing `/api/1.0/Payments` is deliberately disabled in current code. Agree the environment and routing for 1BILL UAT before supplying an alternative sandbox URL.

## Suggested meeting sequence

1. Acknowledge accepted certificate and confirm exact hostname/protected destination.
2. Confirm consumer format, amount slabs, UAT environment, parser details and timezone.
3. Arrange an authenticated Inquiry from each approved provider source while observing server response and VPN traffic.
4. The 24-digit case has been restored. Complete paid-fixture metadata in the already emailed pack, agree the amount slabs, then perform Payment, replay and state checks in the approved window.
5. Set owners/dates for settlement/SFTP, reconciliation, resilience, security work and formal sign-off.

## Further read-only double-check — 29 September

The user requested verification of credentials, transport and consistency between dashboard, tenant APIs and 1BILL, with no system changes.

### Verified

- The supplied username and password exactly match the configured production credentials. Compared SHA-256 digests and reported only boolean results; no credentials are retained in this document.
- Requests to the running HTTP application on loopback, simulating its trusted Nginx forwarding headers, successfully authenticated as each configured provider source (`10.95.8.92` and `10.95.8.94`). All 20 emailed consumers returned the expected business states and amounts. These tests exercise actual HTTP routing/authentication/controller behavior, but do not travel through 1BILL's network or VPN.
- Wrong credentials and an unapproved source returned HTTP 401. A real public HTTPS request using valid configured credentials and a forged provider forwarding header also returned 401.
- A validly authenticated local request to BillPayment with an empty/invalid body returned business code `04` before payment posting. This proves the route/authentication/validation path; no valid Payment was sent and no accounting write was attempted.
- Public HTTPS readiness and HTTPS on protected IP `172.31.254.10` with hostname `app.fintap.pk` returned 200 with certificate verification success.
- Real peer IKEv2 and both CHILD SAs remain installed. Current inbound counters are zero. The user reports that Phase 1, Phase 2, Telnet and certificate milestones have passed; a successful provider-origin authenticated HTTP transaction remains separate evidence.
- Existing consumers: 20, zero duplicate numbers across student and organization billing records, zero wrong-prefix or nonnumeric numbers. School biller `1001` has next sequence 20; organization biller `1002` has next sequence 2. Neither next generated number currently exists.
- All four live reconciliation checks returned zero discrepancies: cached balances, invoice charges, payment evidence and pending invoices with posted allocations.
- Dashboard student creation, SaaS registration and organization request creation use the shared consumer allocator. Invoice creation copies the stored student's identifier. 1BILL reads these stored records; the dashboard does not need to push each invoice into a separate 1BILL database. Production collection requires an active/live tenant.
- Internal billing, 1BILL and permitted manual posting use the shared transactional posting service. SaaS payment simulation is disabled in production; a tenant API key cannot by itself mark a live bill paid through that simulator.

### Items that prevent an unconditional readiness answer

1. **Real HTTP path:** provider traffic must arrive with an allowed source through the agreed protected destination. The VPN selector covers `172.31.254.10`, whereas public DNS points `app.fintap.pk` to `178.238.236.126`. Verify 1BILL's DNS/routing or hostname-to-protected-IP mapping while preserving TLS hostname validation. A public-route request or unexpected source NAT can be rejected even with correct credentials. Local proxy simulations do not prove that mapping.
2. **Paid-fixture metadata:** both paid cases still return an empty `tran_auth_Id`; the supplied specification describes a conditional six-digit authorization field for paid bills.
3. **Tenant API amount semantics:** a live read-only comparison of the overdue school case found `/api/billing/inquiry` and 1BILL both quote PKR 5,500,500 payable. `/api/saas/v1/bill-status/:consumerNumber` reports `outstandingAmount=5500000`, and `/api/saas/v1/check-payment` returns `amount=5500000`; those summaries omit the PKR 500 late fee. A client treating them as the full payable quote can display or submit the wrong amount. Additionally, code inspection shows `check-payment` bases its paid flag on the newest invoice, not the complete outstanding balance; a newest-paid/older-unpaid combination requires coverage before treating that endpoint as an overall settlement answer.
4. **New-tenant length policy:** the allocator supports 14/20/24, but current tenant creation accepts only 14 or 24 and defaults to 24. The provider document separately notes a 20-character gateway maximum while requiring/allowing a 24-digit test case. Provider acceptance of normal 24-digit production generation must be explicit; support for a UAT case is not that confirmation.
5. **Security:** fresh read-only server checks still show inactive host firewall and SSH root/password authentication enabled. These earlier findings remain unfixed. Do not claim complete security compliance.

No application code, server configuration, consumer states, amounts, dates or credentials were changed during this double-check. Only these meeting notes and the procedure log were updated.

## Open internal work — do not claim completed

The 25 September audit found inactive host firewall, publicly listening SSH with root/password authentication enabled, Fintap processes running as root, and missing static-page security headers. These were findings, not fixes, and were not re-audited on 29 September. Historical credential exposure also requires rotation. Primary/DR failover, SFTP/T+1 reconciliation and provider go-live sign-off remain unproven. Certificate acceptance does not close these items.

The 25 September local checks passed 69 backend and 8 frontend tests, lint/type checks, and reported zero production dependency advisories. Prior database/browser evidence is in [deployment verification](DEPLOYMENT_VERIFICATION_2026-09-23.md). On 29 September only the above read-only Inquiry verification was repeated; no Payment was run.

## Source index

- [Current procedure and acceptance record](../procedure.md)
- [Consumer-number allocation](../server/src/services/consumerNumberService.js)
- [1BILL controller](../server/src/controllers/oneLinkController.js)
- [1BILL authentication and routes](../server/src/routes/onelink.js)
- [Generic REST v1.5 supplied specification](1Link/1LINK_Generic_REST_Based_Specification_v1_5.md)
- [Supplied network standard](1Link/1LINK_Data_Network_Guidelines_and_Standards.md)
- [Historical handover](1BILL_HANDOVER_CHECKLIST_2026-09-05.md): contains obsolete hostname, network and API descriptions; use this brief and current code for answers.

At the meeting, use this brief to retrieve facts quickly and perform a fresh read-only query when a live consumer's amount/status is needed. Do not rely on conversational memory or a historical sheet for financial state.
