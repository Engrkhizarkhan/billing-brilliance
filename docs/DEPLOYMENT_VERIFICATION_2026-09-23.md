# Deployment and 1BILL verification — 23 September 2026

## Evidence before release

The existing production and sandbox installations were inspected over verified SSH. Both APIs and both outbox workers were online. The deployed code was `adb48df99616afb0b11c451e204b3d18c608beea`; Node was 22.23.2 and MySQL 8.0.46.

Encrypted database/configuration backups were created under `/var/backups/fintap/20260923-hardening`, with a protected off-host copy. Both database dumps were decrypted and restored into separate test databases. Row counts matched in all 32 tables in each database. Migrations 012–014 succeeded on both restored copies.

Production contained 19 school invoices with no original ledger charges, including two invoices with canonical payment credits. The bounded restoration operation was rehearsed on the restored production copy. It appended 19 charges totaling PKR 20,255,999 based on existing invoices, preserved both payments, and cleared all four reconciliation checks. These are existing invoice amounts, not new payment receipts. The production correction was subsequently applied only after its plan hash matched the restored-copy rehearsal. All four reconciliation checks then returned zero discrepancies.

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
| Network | At approximately 05:19 UTC on 23 September, a bounded initiation authenticated the actual peer 103.248.140.4 and established both CHILD SAs: 172.31.254.10/32 to 10.95.8.92/32 and 10.95.8.94/32. This fresh negotiation supersedes historical “peer silent” findings and confirms the current selectors were accepted. No inbound protected application packets were observed. Three source-bound ICMP probes produced encrypted outbound packets but no replies; ICMP support is unknown. |
| Crypto | Actual peer negotiation selected IKEv2 AES-256-CBC, SHA-256, PRF-SHA256 and ECP256/DH19. The second CHILD exchange selected ESP AES-256/SHA-256/ECP256 (PFS19). TLS probes verified a valid CA certificate, TLS 1.2/1.3, and explicit protocol rejection for TLS 1.0/1.1. |
| Resilience | Supplied network standard calls for dual connectivity at primary and DR with automatic failover. Current single-host evidence does not demonstrate this; obtain agreed topology or exception. |
| Joint UAT | Requires provider-origin application requests through the now-established tunnel, approved mnemonic/UCID, amount slabs and test window. All 19 existing school consumers passed local read-only inquiry/status/amount-format probes; a public request with valid credentials but forged provider forwarding headers was rejected with 401. These local probes are not joint UAT or settlement evidence. |
| Settlement | Bank settlement/SFTP files, T+1 reconciliation, correction procedures, support and formal provider sign-off are not proven by application tests. |

## Release outcome

Final production and sandbox revision: `5681e4f5d19648da891f19c774282f8756c81843`. GitHub Actions run [35823650724](https://github.com/Engrkhizarkhan/billing-brilliance/actions/runs/35823650724) passed every check and deployment at approximately 05:47 UTC (10:47 PKT). Both public readiness endpoints report this revision; all four processes run from its immutable release directory with zero restarts at verification. No real bank payment was used for application regression tests.

## Deployment reliability findings

The first production attempt (`9208a17`) failed its exact process-directory check because PM2 startOrReload retained old executable/cwd values. The automated rollback restored the prior release and both APIs responded successfully afterward, with forward migrations retained. The correction replaces only the four named Fintap processes before starting the selected release. An isolated real Linux PM2 rehearsal verified old → new → old responses and the exact process directory; all 66 backend unit checks passed again. This preserves unrelated services on the host. Single-instance replacement can cause a brief reconnect window.

StrongSwan reported an automatic source-route installation warning. The existing default route resolves source-bound traffic correctly, XFRM policies are installed for both selectors, and outbound protected packets were counted. HTTPS on the protected local address was verified with the application hostname and certificate. No routing/VPN configuration was changed. End-to-end inbound HTTPS must still be demonstrated by 1LINK. Automatic startup/DPD/failover behavior was not altered or certified by this connection attempt.

## Live verification and follow-up fixes

- Release `d31fa720` activated both environments and passed exact process-directory checks. A subsequent live browser probe found that mktemp's 0700 release-directory permission prevented Nginx from reading the frontend. Permission was immediately corrected to 0755, restoring public HTTP 200. Release `6ae6476b` then deployed successfully with permanent traversal permissions and public HTML plus byte-for-byte asset verification. Deployment tests now cover HTML and asset rollback, including a misleading HTTP-200 HTML fallback.
- Nine administrator pages, thirteen school pages and eleven organization pages were exercised in an authenticated production browser with no API or browser exceptions during stable operation. The UAT organization's webhook configuration warning reflects missing customer configuration; no callback destination was invented.
- A maintenance-session exit during the expected process replacement window exposed an asynchronous restoration bug. The follow-up waits for the administrator profile and preserves maintenance controls/token on failure, allowing retry. Eight frontend tests now include delayed restoration and temporary-outage retry.
- Both databases passed all four read-only reconciliation checks after deployment. All 19 school consumers passed deployed inquiry probes; public forged-source access was rejected. Both production worker/API and sandbox worker/API ran from the exact release directory, with fresh heartbeat and no spontaneous restarts observed. Unrelated application processes were retained.
- Fintap application/PM2/deploy log rotation was installed and validated (daily, 10 MB size threshold, 14 rotations). PM2 startup service was enabled and active. These checks do not demonstrate off-site automated disaster recovery or provider-approved dual-site failover.
- No real payment, settlement transfer, provider credential rotation, or VPN topology change was performed. Existing 19-invoice/2-payment records were preserved with explicit charge-restoration audit records.

Automated release totals: 69 backend unit tests, 25 MySQL integration regressions, eight frontend unit tests, three CI browser regressions, plus the live 33-page portal checks. Existing seven frontend Fast Refresh lint warnings remain; no lint errors. Provider probes are inquiry-only in production; payment mutation/concurrency/rollback tests use isolated fixture data.

Final live maintenance verification passed: a browser-only 503 response for the administrator profile preserved the Exit Session button, and retry restored the administrator dashboard. No server outage was induced by this test. Final production and sandbox reconciliation at 05:47 UTC returned zero discrepancies in every check. No errors were present in the final release's application error log at that time.

The software deployment is complete. Unresolved provider requirements remain in the matrix above; this report does **not** claim complete 1BILL production certification, bank settlement approval, or verified automatic disaster recovery. The manual encrypted backup/restore and observed service checks are the evidence actually obtained. Existing restored test databases and rollback releases are retained, protected on the host, for recovery review.
