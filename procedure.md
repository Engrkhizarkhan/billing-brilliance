# Fintap / 1BILL procedure and issue record

Last reviewed: 29 September 2026 (Pakistan time)

This is the working record of the Fintap deployment, 1BILL certificate issue, and handover. A passing local check is evidence for that check only; it is not 1LINK/1BILL acceptance or permission to go live. Keep dated observations separate from pending provider decisions. Do not add passwords, VPN pre-shared keys, purchase tokens, private certificate keys, payment-card details, or consumer data to this file.

## Current position

| Item | Verified position |
| --- | --- |
| 1BILL application hostname | `app.fintap.pk` (not the apex `fintap.pk`) |
| Public DNS for `app` | A record resolves directly to `178.238.236.126`; Cloudflare proxy is **DNS only** for this record |
| Public HTTPS certificate | Sectigo PositiveSSL DV, RSA 2048, SAN `app.fintap.pk`; valid 24 September 2026 through **10 April 2027** |
| Certificate on origin | Nginx serves the Sectigo leaf and intermediates from `/etc/ssl/certs/fintap-sectigo-20260924/fullchain.pem`; the private key remains on the server with root-only access |
| 1BILL package | [`output/1bill-certificate-review/sectigo-activation/1BILL-app.fintap.pk-Sectigo-2026.zip`](output/1bill-certificate-review/sectigo-activation/1BILL-app.fintap.pk-Sectigo-2026.zip) |
| 1BILL email | Draft was unsent at the 24 September mailbox check; later sending details have not been rechecked. User reports certificate acceptance on 29 September. |
| Renewals and billing | PositiveSSL order automatic renewal **OFF**. Separate AutoInstall SSL subscription renewal cancelled; its paid term remains available through 1 September 2027. Saved payment method removed. |
| External acceptance | User confirmed on 29 September that **1BILL accepted the Sectigo SSL certificate**. Provider-origin application UAT and final go-live approval remain separate, unverified items. |

The public apex `fintap.pk` currently presents a separate Cloudflare/Let's Encrypt YE1 certificate. This does **not** describe the certificate served by the 1BILL hostname `app.fintap.pk`. When diagnosing another certificate rejection, first confirm the exact hostname that 1BILL tested.

## Sequence of problems, actions, and results

### 1. The original certificate handover failed

- On 22 September, a certificate ZIP was shared for `app.fintap.pk`. Subsequent files in `.pem` and `.p7b`, then `.crt` and `.cer`, attempted to address import-format and missing-chain feedback. Repackaging did not change the underlying certificate.
- On 24 September, 1BILL said the shared full-chain `.crt` appeared to be issued by **YE1**, the individual `.cer` files were not full-chain files, and its team required a full-chain `.crt` from a CA such as Sectigo, DigiCert, or GlobalSign. This records 1BILL's stated acceptance rule; it does not imply that Let's Encrypt is generally an untrusted CA.
- The public `app.fintap.pk` hostname was then still behind Cloudflare, which served a YE1 certificate to external clients. An origin-only certificate change could not by itself change what 1BILL saw on the public hostname.

### 2. A new Sectigo certificate was obtained

- A one-year Comodo PositiveSSL (DV) order was bought through CheapSSLSecurity. The resulting certificate is **issued by Sectigo** for `app.fintap.pk`; the reseller and product branding do not change its issuing CA.
- The separate AutoInstall SSL add-on was also purchased. Its first charge was USD 7.49, in addition to USD 7.99 for the PositiveSSL certificate. The add-on advertised USD 7.99 per year for future renewal.
- The AutoInstall agent was installed on the server, but its certificate-install attempt with `--includewww` stopped at **“WWW binding not found.”** Do not copy its order token into this record or retry that command without checking the requested hostnames. The final `app.fintap.pk` certificate was issued through file-based domain validation and installed **manually**, not by AutoInstall.
- The issued certificate is RSA 2048 and includes only `app.fintap.pk` in its SAN. The certificate expires on 10 April 2027 even though the commercial order ends on 24 September 2027; a manual reissue is needed before the certificate's earlier expiry.

### 3. The origin was updated, then the public hostname was corrected

- The Sectigo leaf and intermediates were installed for the `app.fintap.pk` Nginx virtual host. Nginx configuration validation passed. The private key stayed on the origin server and was never placed in the handover ZIP.
- Initially, external checks still saw Cloudflare's YE1 certificate. The cause was the proxied `app` DNS record, not the Nginx installation.
- With the user's authorization, only the Cloudflare `app` A record was changed from **Proxied** to **DNS only**. The apex, `www`, and sandbox records were left as they were. Public DNS then resolved `app.fintap.pk` to `178.238.236.126`, and public TLS presented Sectigo directly.
- Trade-off: `app.fintap.pk` no longer receives Cloudflare's proxy/WAF/DDoS layer, and the shared origin IP is exposed. Switching this record back to Proxied would cause Cloudflare's edge certificate to be presented again unless a separate edge-certificate arrangement is made.

### 4. The replacement ZIP and unsent email were prepared

The replacement ZIP contains four files:

| File | Purpose |
| --- | --- |
| `app.fintap.pk-fullchain.crt` | Main file requested by 1BILL: leaf, Sectigo intermediate, cross-signed Sectigo root, and USERTrust root, in chain order |
| `app.fintap.pk-leaf.crt` | Site certificate alone, for inspection or an importer that asks separately for the leaf |
| `Sectigo-CA-Bundle.crt` | CA certificates without the site certificate |
| `README.txt` | File guidance, hostname, key type, and validity |

No private key is included. The ZIP SHA-256 is `249a3e530e16b9355ecb56c51b3f55a3625af951a36487c7eeab4d70220f4878`.

An unsent Gmail draft titled **“Updated Sectigo fullchain certificate for app.fintap.pk”** is addressed to `darain.jamal@1link.net.pk` only. It says the new Sectigo certificate replaces the previously shared YE1 certificate, identifies the full-chain `.crt`, explains that the private key is omitted, and asks 1BILL to confirm import before continuing the configuration slot. The attached ZIP was downloaded back from the draft and matched the local ZIP **byte for byte** by SHA-256. The draft was checked, not sent.

### 5. Unneeded renewal and saved-card setup were removed

- The PositiveSSL order itself already showed **Automatic Renewal: OFF** and **Installation Method: Manual**.
- The AutoInstall SSL subscription was separately set to **Cancel Subscription Renewal**. The other offered choice, immediate cancellation and refund, warned that issued certificates could be revoked; it was **not** selected. The account confirmed cancellation and then showed **“No active subscription”** as the next-bill status, while the existing paid term remains available through 1 September 2027. No refund was requested.
- The saved Mastercard was removed from CheapSSLSecurity. The account showed **“Card deleted successfully”** and, after reload, only an option to add a payment method. Historical receipts can still name the former payment method; those are not a saved card.
- A fresh public HTTPS check afterward still returned HTTP 200 with a valid Sectigo chain.

## Verification evidence and how to repeat it

At the 24 September check, the public site returned HTTP 200 from `178.238.236.126`, certificate validation returned OK, the SAN matched `app.fintap.pk`, and TLS 1.2 and 1.3 worked. TLS 1.0 and 1.1 were rejected. The first **three** certificates served by Nginx matched the first three certificates in the ZIP's full-chain `.crt` exactly. The ZIP has an additional trust root; web servers normally omit that root from the TLS handshake. The ZIP leaf also matched the public component of the origin's private key without exposing the key.

Safe, read-only spot checks:

```sh
dig +short A app.fintap.pk
curl -sS -o /dev/null -w 'HTTP %{http_code}; TLS verify %{ssl_verify_result}; IP %{remote_ip}\n' https://app.fintap.pk/
openssl s_client -connect app.fintap.pk:443 -servername app.fintap.pk -verify_hostname app.fintap.pk </dev/null
unzip -l output/1bill-certificate-review/sectigo-activation/1BILL-app.fintap.pk-Sectigo-2026.zip
shasum -a 256 output/1bill-certificate-review/sectigo-activation/1BILL-app.fintap.pk-Sectigo-2026.zip
```

Expected: the A record is `178.238.236.126`, HTTP is 200, `Verify return code: 0 (ok)`, the leaf issuer is `Sectigo Public Server Authentication CA DV R36`, and the ZIP hash equals the value above. Check the actual certificate dates every time; the archived checks are not a substitute for current validation.

Production and sandbox `/api/health` and `/api/ready` returned HTTP 200 at the last check; readiness includes a database query and, in production, a recent outbox-worker heartbeat. All four Fintap API/worker processes were online without restarts. Anonymous POSTs to both 1BILL Inquiry and Payment URLs returned controlled HTTP 401 responses; no live payment was submitted. Fresh local tests passed: **69 backend unit tests** and **8 frontend tests**. The [23 September deployment verification](docs/DEPLOYMENT_VERIFICATION_2026-09-23.md) separately records 25 database integration regressions, 3 CI browser regressions, 33 authenticated production-page checks, recovery work, and its limits.

## Related deployment and network problems

These are summarized here so the certificate work is not mistaken for the entire 1BILL integration history. Details and evidence are in the [deployment verification](docs/DEPLOYMENT_VERIFICATION_2026-09-23.md) and [production hardening notes](docs/PRODUCTION_HARDENING_2026-09-23.md).

| Problem | Action and observed result |
| --- | --- |
| Historic invoice/ledger mismatch | A restored-copy rehearsal preceded a bounded production correction. The existing payments were preserved and four read-only reconciliation checks returned zero discrepancies afterward. |
| Deployment process retained an old executable/directory | The first attempt rolled back; process replacement was corrected and rehearsed before the final production/sandbox release `5681e4f5d19648da891f19c774282f8756c81843`. |
| Frontend files were initially blocked by restrictive release-directory permissions | Traversal permissions were corrected, then made permanent in the deploy process; HTML and assets were rechecked publicly. |
| Maintenance-session retry could lose recovery controls during a brief outage | The restoration flow was corrected and covered by frontend regression tests. |
| 1BILL VPN connectivity was uncertain | The actual peer at `103.248.140.4` authenticated through IKEv2 and both protected network paths were installed. At the latest read-only check, **inbound protected packet counts were zero**; this does not demonstrate a 1BILL-origin application request. A separate laptop control test proved the local VPN/application path, not 1BILL's own traffic. |

## Still open before 1BILL go-live

1. Certificate acceptance is closed based on the user's 29 September confirmation. Retain the provider acceptance message when available; do not infer payment UAT or go-live approval from certificate acceptance.
2. Observe a real request originating from 1BILL through the agreed VPN selectors, including TLS and an authenticated Inquiry, followed by joint Payment UAT using approved synthetic cases. Local tests and an established VPN alone do not prove this.
3. Resolve written contract ambiguities: 20- versus 24-digit consumer numbers, response-field capitalization, reserved-field layout, amount slabs, exact required TLS cipher, and whether FetchBundle is in scope.
4. Demonstrate or agree an exception for primary/DR connectivity and automatic failover. Complete settlement/SFTP and T+1 reconciliation tests and obtain formal provider/bank sign-off.
5. Correct the older [1BILL handover checklist](docs/1BILL_HANDOVER_CHECKLIST_2026-09-05.md), which still has `app.fintap.com` placeholders and `TO CONFIRM` fields. The verified current 1BILL hostname is `app.fintap.pk`; do not send that checklist unchanged.
6. Treat the integration password disclosed in historic email correspondence as exposed. Rotate it through an approved secure channel before relying on it for production UAT; never copy it into this record or an ordinary email.
7. Reissue and install the Sectigo certificate **before 10 April 2027**. Because both vendor auto-renewal and AutoInstall renewal are off, assign a human owner and a reminder well before expiry. Recheck the live hostname and regenerate the 1BILL ZIP after any reissue.
8. Complete paid-fixture authorization metadata before joint testing. All 20 emailed consumers exist. The previously expired 24-digit case was restored at the user's request on 29 September, retaining its identifier and PKR 6,000,000 amount; its validity now ends 31 October 2026 at 23:59:59 PKT. Deployed Inquiry returns `00/U`. Two manually paid fixtures still have blank authorization metadata. See the corrected [30 September meeting brief](docs/1BILL_MEETING_BRIEF_2026-09-30.md).

## Procedure for the next certificate reissue or incident

1. Confirm the exact hostname and the certificate 1BILL sees. `app.fintap.pk` and `fintap.pk` currently present different certificates. Record the live issuer, SAN, expiry, chain, and fingerprint before changing anything.
2. Check the vendor order and Nginx state. Keep the existing private key protected; if generating a new key/CSR, use a controlled server-side process and never email the private key. Complete the CA's domain validation for the actual hostname.
3. Validate the issued certificate and its intermediate chain, hostname, validity, and public-key match before installing it. Preserve a rollback copy of the prior Nginx configuration and certificate files in protected server storage.
4. Install the new leaf plus intermediates on the origin, test Nginx syntax, reload it, and check the **public** `app.fintap.pk` endpoint. Do not assume an origin-only test represents what 1BILL sees when a proxy is enabled.
5. Build a new public-certificates-only ZIP, verify the full-chain order and trust path, and compare its leaf fingerprint against the live site. Record the ZIP SHA-256. Keep the previous ZIP clearly marked obsolete.
6. Review the recipient, subject, body, and attachment of the 1BILL email before sending. Record the sent message and 1BILL's import/handshake result; do not interpret a drafted email as a completed handover.
7. Run a 1BILL-origin Inquiry and agreed Payment UAT, then record the observed VPN traffic, provider response, reconciliation result, and sign-off. Do not run a real payment merely as a certificate spot check.

For each future event, append a dated entry recording: **symptom → evidence → cause → change → verification → remaining risk → owner/status**. Update the current-position table and expiry date after each accepted change rather than silently overwriting historical facts.

## Dated event log (append new entries below)

| Date | Event and evidence | Status / next owner |
| --- | --- | --- |
| 22 September 2026 | Initial certificate ZIP and 1BILL API details were shared. The later format changes did not change the underlying YE1 certificate. | Superseded by the Sectigo package; do not resend the old ZIP. |
| 23 September 2026 | Production/sandbox release, database reconciliation, CI/browser checks, and IKEv2 peer negotiation were recorded in the linked deployment report. | Application deployed; provider-origin UAT, settlement, and sign-off still open. |
| 24 September 2026 | 1BILL reiterated that it needed a trusted-CA full-chain `.crt`. Sectigo issued a new certificate; Nginx installed it. Changing only the Cloudflare `app` record to DNS only made Sectigo visible publicly. | Public certificate verified; 1BILL import acceptance pending. |
| 24 September 2026 | New public-certificates-only ZIP was built; its attachment in the Gmail draft matched byte for byte. The live site served the same leaf and intermediates. | Draft remains unsent; review recipient and send when authorized. |
| 24 September 2026 | PositiveSSL auto-renewal was confirmed off; AutoInstall renewal was cancelled without immediate revocation; saved card was removed. Live HTTPS remained valid. | Manually reissue the certificate before 10 April 2027. |
| 29 September 2026 | User reported that 1BILL accepted the Sectigo certificate and requested preparation for the following day's system meeting. | Certificate acceptance recorded; no email was sent or checked in this preparation. |
| 29 September 2026 | Readiness returned HTTP 200 on release 5681e4f5d19648da891f19c774282f8756c81843. Both real-peer VPN CHILD SAs were installed; current inbound counters were zero. Exact checks found none of the historical 20 UAT identifiers in either current environment. Production had 19 non-deleted school consumers of length 14, one active/live tenant with a 14-digit policy and one active/live tenant with a 24-digit policy; the payment table contained two posted manual payments. | Meeting facts refreshed using read-only checks. Historical UAT sheet must be replaced before execution. No application code, server configuration, or payment data changed. |
| 29 September 2026, later correction | User supplied the actual sent email. Its list differs from the historical CSV. All 20 emailed identifiers exist in production. Direct deployed Inquiry checks in a read-only transaction verified 19 matching amounts/states; the organization test record is expired, and paid fixtures lack six-digit authorization metadata. | Retract the earlier inference that the sent consumers were absent or all needed recreation. Update the brief. No code, configuration, payment data or credentials changed; no provider-origin test was claimed. |
| 29 September 2026, authorized UAT correction | User requested that the 24-digit case match the emailed unpaid PKR 6,000,000 case. Checked absence of payment/accounting evidence, saved a root-only row backup, and atomically reopened just that request with due date 31 October and expiry 31 October 23:59:59 PKT. Audit `bf8597ac-55af-4066-b3aa-af1da5a0631e`; backup `/var/backups/fintap/uat24-20260929-p1Bibj/record-before.json`. | Precommit and independent postcommit deployed Inquiry checks passed: `00/U`, correct amount and date. No payment submitted, consumer number preserved, no code or server configuration changed. Paid-fixture metadata and provider-origin UAT remain open. |
| 29 September 2026, read-only double-check | Supplied credentials matched production; running-app HTTP checks using local trusted-proxy source simulation passed all 20 inquiries and both allowed source addresses. Invalid password/source and public forged-source checks returned 401. BillPayment invalid-body validation returned 04 without posting. Protected HTTPS and public readiness passed; VPN current inbound counters remained zero. Existing consumer namespaces had no collisions; all four accounting reconciliation checks were clear. | No system changes. Flagged paid authorization fields, tenant API summaries omitting the late fee, newest-invoice-only status semantics, default 24-digit new-tenant policy vs provider maximum ambiguity, and unchanged server-hardening gaps. Actual provider-origin HTTP access still requires observation. Details in the meeting brief. |

For the next row, use: `date | symptom, observation, action, and verification | owner, open item, or accepted result`. Do not close an item based only on an email draft, a healthy local test, or a VPN security association when 1BILL's own confirmation is required.

## 1 October 2026 — 1BILL removes the routing prefix

**Symptom:** 1BILL reported `10517210010001` as blocked while Fintap showed unpaid.
Read-only production checks confirmed an active student, active/live tenant, pending
PKR 2,500 invoice due 5 October, and full-number Inquiry response `00/U`.
The invoice month is September (`2609`), distinct from its October due date.

**Evidence and cause:** Nginx recorded a provider-origin inquiry from `10.95.8.92`
at 11:12:24 PKT, HTTP 200, 269 response bytes. IPsec inbound/outbound traffic was
present. The provider screenshot showed response code `01`, internal mapping `118`,
`CONSUMER_NO=10010001`, and the full utility account number `10517210010001`.
The user subsequently confirmed with 1BILL that it removes the six-digit routing
prefix before sending `consumer_number`. Local HTTP probes reproduced `00/U` for
the full number and `01/B` for the shortened number. Our generic error response's
`B` field explained the blocked appearance; this was not an inactive consumer.
The earlier missing-bank-mnemonic hypothesis was not the actual diagnosis.

**Authorized correction:** Normalize at the 1BILL boundary in both Inquiry and
Payment using configured `FINTECH_PREFIX`. Continue accepting full numbers; use
the full number for accounting and duplicate detection. Reject ambiguous matches
instead of choosing a financial account. No consumer identifiers, balances,
invoice dates, credentials or VPN settings need changing.

**Verification plan/status:** Unit coverage checks prefix restoration, leading
zeros, full-number compatibility, namespace validation and ambiguous matches.
Disposable-database regressions cover full/short 14-, 20- and 24-digit consumers,
mixed-format concurrent duplicate payments, paid, blocked, overdue, suspended and
expired cases, plus organization payments. CI and live read-only Inquiry checks
must pass before reporting deployment complete. Payment tests use disposable
fixtures; provider-origin retry and joint UAT confirmation remain separate steps.

Predeployment checks: all 82 backend unit tests and backend lint passed. The first
CI run passed the MySQL regression step but exposed newly reported vulnerabilities
in the existing frontend dependency lockfile. Applied compatible patch updates to
`brace-expansion` and `dompurify`; the resulting dependency audit reports zero
vulnerabilities. The complete pipeline is rerun on the patched revision. A
read-only production namespace scan found 20 stored consumers and no ambiguous
full/short pairs.

**Deployment and live verification, 1 October 2026 at 11:38 PKT:**
[PR #9](https://github.com/Engrkhizarkhan/billing-brilliance/pull/9) merged as
`6f47dcfa483ab2b01d3e3d2fab9c2c6b52e67832`.
[Production run 36825594662](https://github.com/Engrkhizarkhan/billing-brilliance/actions/runs/36825594662)
completed successfully, including 82 backend unit tests, 31 MySQL regressions,
frontend and browser checks, security audits and deployment. Public readiness
reported that exact revision. Forty read-only HTTP inquiries against the running
production app compared all 20 emailed consumers in full and prefix-stripped
form. Every pair was identical and matched the expected unpaid/paid/blocked
state, including the overdue and 24-digit organization cases. `10010001` returned
`00/U`, PKR 2,500, due `20261005`; `100200000000000001` returned `00/U`, PKR
6,000,000. Production payment count remained two before and after verification.
These were server-local requests simulating the trusted proxy's provider source;
they verify the deployed HTTP handler, not a new provider-origin transaction.
1BILL must retry through its own gateway to confirm end-to-end success. The
original provider VPN request is independently evidenced above.

## 1 October 2026 — provider-confirmed Inquiry response formatting

**Symptom/evidence:** 1BILL supplied an expected/actual response comparison and
confirmed that `consumer_Detail` must have a capital D. Absent paid fields must
contain their exact fixed number of spaces, not empty strings. The archived
generic document's parameter table uses lowercase `consumer_detail`, while its
sample uses `consumer_Detail`; the provider's explicit confirmation resolves
this inconsistency for this integration.

**Correction:** Use `consumer_Detail` across provider Inquiry success/error/auth
responses and admin previews. Pad absent dates to 8 ASCII spaces, paid amount to
12, authorization ID to 6, and absent billing month to 4. Consumer names remain
30 characters. Keep `reserved` empty as in the confirmed example; preserve
actual dates, amounts and paid transaction metadata. No customer/payment data
or prefix handling changes are needed.

**Verification:** Unit tests assert exact response keys and spaces for unpaid,
paid with missing metadata, invalid, blocked, not-found, database-error and
authentication-error cases. MySQL regressions check key sets and fixed widths
on every tested Inquiry, including school/organization, full/short number,
paid/overdue/expired and admin-preview cases. Deployment and live character-count
verification follow the normal CI gates; provider retry remains required.

The Inquiry format fix deployed successfully in PR #10, revision
`bddd249a9676b787c63e78f724a2ebea3b3f91ca`, production run `36827510376`.
All 88 unit tests and 32 MySQL regressions passed, alongside frontend/browser
checks and audits.

**Follow-up Payment format confirmation:** The user supplied the exact envelope
`{"response_Code":"00","reserved":"","identification_parameter":"5299"}`.
Use lowercase `identification_parameter` in both successful and failed Payment
responses, including authentication errors, and preserve this key order.
The historic generic document uses capital I, but the provider-confirmed example
controls this integration. Preserve the existing dynamic identification value;
`5299` is a sample, not a replacement voucher for every payment. Payment errors
keep this optional field empty. No financial data changes or production payments
are needed to validate formatting.

Live Inquiry verification after PR #10 confirmed exact key/space widths for all
20 consumers (full and short inputs), four admin preview cases, and an auth error.
`10010001` now correctly returns `00/P`: a provider-origin payment arrived from
`10.95.8.92` at 11:52:33 PKT, and production records show a posted `onelink`
PKR 2,500 payment with voucher `354644`. The check's former unpaid expectation
therefore failed; formatting and full/short equivalence passed. The local check
made no payment (count remained three). This establishes an observed provider
payment, not completed provider certification. Preserve the payment evidence and
use another unpaid consumer for subsequent unpaid-case testing.

**Final format deployment verification, 1 October at 12:07 PKT:** PR #11 merged
as `03015672e77a688cc97b593d94560fb438d19dbb`; production run `36828252733`
passed and public readiness confirmed this revision. Forty server-local HTTP
Inquiries (20 consumers, both input forms) passed exact key/space-width and
current-state checks. Four admin previews and an Inquiry authentication error
also passed. Payment authentication-error and authenticated invalid-body probes
both returned exactly `{"response_Code":"04","reserved":"","identification_parameter":""}`
(HTTP 401 and 200 respectively). Successful Payment format is covered by the
disposable MySQL regressions; no production payment was generated for this check.
Production payment count remained three. User should ask 1BILL to verify the
updated format through its gateway; `10010002` remains an unpaid PKR 4,999 case,
while `10010001` is paid following its provider-origin payment.

## 1 October 2026 — blank status for blocked/inactive consumers

The user relayed a further provider requirement: blocked/inactive Inquiry
responses must contain one ASCII space in `bill_status`, instead of `B`.
Apply this to code `02` school and organization responses and admin previews.
Keep response code `02`, all previously agreed field widths and casing, and
payment rejection unchanged. Unpaid/paid remain `U`/`P`; other error codes are
outside this requested correction. Tests assert the exact space for inactive
students and failed organization requests, including preview and payment-denial
checks. Deploy through CI, then verify both existing blocked UAT consumers
using full and shortened identifiers without changing consumer data.

**Verified deployment at 12:26 PKT:** PR #12 merged as
`3467dcefce1ebab75bc5a39c3941eebfa6a0932b`; production run `36829979542`
passed and public readiness reported this revision. Both blocked UAT consumers
(`10010018`, `10010019`) returned code `02` and a one-character status whose
ASCII code is 32, in full and shortened forms. Both admin previews matched and
remained nonpayable. Read-only controls returned `P` for `10010001` and
`10010002`, and `U` for `10010003`. The first control check's old unpaid
expectation for `10010002` was outdated; it is now paid. No consumer state was
changed by these checks; payment count remained four. Provider-origin retest of
the blocked response remains for 1BILL to confirm.

## 1 October 2026 — blank status for invalid Inquiry responses

User requested invalid consumers also return a blank status and explicitly asked
to skip testing and push for deployment. All unsuccessful Inquiry responses now
use one ASCII space, including missing consumers, invalid requests, internal
errors and authentication failures, with matching admin previews. Response codes
and successful U/P states are unchanged. Updated existing test expectations but
did not run local tests or live probes; required CI/deployment checks remain
enabled.

## 1 October 2026 — paid Inquiry code 06

The user confirmed that paid consumers must return response code `06` rather
than `00`, and requested testing/deployment. Change paid school and organization
Inquiry responses and admin previews to `06/P`, preserving payment metadata.
Unpaid Inquiry and newly accepted Payment remain `00`; duplicate payment remains
`03`. The blank status for all unsuccessful inquiries from PR #13 is retained
(no `B` output). PR #13 production run `36831131224` completed successfully.
Unit and database regressions cover paid metadata, full/short consumer forms,
school/organization previews, new payment/replay behavior and blank error status.
