# Deployment and 1BILL verification — 23 September 2026

## Evidence before release

The existing production and sandbox installations were inspected over verified SSH. Both APIs and both outbox workers were online. The deployed code was `adb48df99616afb0b11c451e204b3d18c608beea`; Node was 22.23.2 and MySQL 8.0.46.

Encrypted database/configuration backups were created under `/var/backups/fintap/20260923-hardening`, with a protected off-host copy. Both database dumps were decrypted and restored into separate test databases. Row counts matched in all 32 tables in each database. Migrations 012–014 succeeded on both restored copies.

Production contained 19 school invoices with no original ledger charges, including two invoices with canonical payment credits. The bounded restoration operation was rehearsed on the restored production copy. It appended 19 charges totaling PKR 20,255,999 based on existing invoices, preserved both payments, and cleared all four reconciliation checks. These are existing invoice amounts, not new payment receipts. The production correction must match the exact reviewed plan hash and database identity.

25 database regressions passed on the server, including concurrent payment replay, transactional rollback, authorization, overdue/expired/blocked bills, exact payment amount, provider fields and dates, historical repair safeguards, and supported consumer lengths. Backend unit tests, frontend tests/build, and release CI are additional gates.

## 1BILL requirements and remaining acceptance work

The application is assessed against the supplied `1LINK_Generic_REST_Based_Specification_v1_5.md` and `1LINK_Data_Network_Guidelines_and_Standards.md`, plus the Internet IKEv2 template and historical handover documents. Their contradictions need provider confirmation; passing application tests does not grant certification.

| Area | Evidence / limitation |
|---|---|
| Invoice URLs, header credentials, field formats | Contract tests cover inquiry/payment, fixed-width amounts, name padding, paid metadata, invalid credentials and malformed fields. Empty configured credentials now fail closed. |
| Dates | Impossible calendar dates and times are rejected before database access. |
| Duplicate key | Consumer + authorization ID + date + time; concurrent requests create one accounting bundle and duplicates return 03. |
| Bill states | Paid, blocked, expired, overdue and exact amount behaviors tested in isolated data. |
| Consumer length | Existing 14, 20 and 24 digits tested. The provider document lists 24 but separately states 1LINK max 20; written acceptance remains required. |
| Response field capitalization | The supplied response table and examples disagree (`tran_auth_id` / `tran_auth_Id`, `consumer_detail` / `consumer_Detail`). Current compatible response keys are retained; confirm provider parser expectations. |
| Reserved fields | Specification field tables and component lengths conflict. Confirm agreed lengths/layout and serial-number requirement with the provider. |
| FetchBundle | Invoice-only product excludes it. Written provider scope confirmation remains outstanding. |
| Network | No active 1LINK SA observed in this audit. Current local protected address is 172.31.254.10/32; older handover documents advertise 172.29.250.10/32. Remote hosts are 10.95.8.92/32 and 10.95.8.94/32; peer 103.248.140.4. Do not assume provider agreement. |
| Crypto | Local connection declares IKEv2 AES-256/SHA-256/DH19/PFS19. Negotiation with the actual peer remains unproven. |
| Resilience | Supplied network standard calls for dual connectivity at primary and DR with automatic failover. Current single-host evidence does not demonstrate this; obtain agreed topology or exception. |
| Joint UAT | Requires provider-origin traffic through the approved tunnel, approved mnemonic/UCID, amount slabs, credentials, and test window. Local forwarding-header simulations are not tunnel proof. |
| Settlement | Bank settlement/SFTP files, T+1 reconciliation, correction procedures, support and formal provider sign-off are not proven by application tests. |

## Release outcome

Pending release completion. Append the deployed revision, external probes, reconciliation and browser results after activation. No real bank payment is required for application regression tests.
