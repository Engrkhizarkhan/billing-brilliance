# 1BILL Aggregator Representative Handover Pack

Zynotch PVT Limited and 1LINK | Prepared 5 September 2026 | Integration: 1Bill Invoice Services

## Agreed scope at a glance

| Item | Agreed value |
|---|---|
| Business role | Zynotch PVT Limited as Aggregator |
| Service | 1Bill invoice-based collection |
| Assigned prefix | 105172 |
| Settlement bank | United Bank Limited |
| Settlement cycle | T+1 |
| Environments | Separate UAT and Production connectivity |
| Transfer channel | New 1LINK SFTP folder for settlement reports and related documents |
| Zynotch services | Payment and Balance/Bill Inquiry REST APIs |

This pack is a preparation checklist, not a completed submission. Values marked TO PROVIDE or TO CONFIRM must be completed by the named owner. Do not send passwords, API keys, private keys, or unredacted consumer data in normal email.

## Package to send to the 1BILL representatives

### Send as the formal email attachment set

- [ ] Signed and completed PRFQ form for scope locking.
- [ ] Completed Aggregator Details Sheet.
- [ ] This completed handover pack with all TO PROVIDE fields resolved.
- [ ] CA-authorized server certificate and intermediate chain in .crt or .cert format; never include the private key.
- [ ] API contract/OpenAPI file or the agreed field-level request/response document for Inquiry and Payment.
- [ ] UAT test-data sheet containing the 20 requested consumer cases, sent through the approved secure channel.
- [ ] Network diagram showing Zynotch primary/DR endpoints, NAT, firewall, load balancer, and application path.
- [ ] Support and escalation matrix for business, application, database, network, security, and settlement owners.
- [ ] Planned UAT dates, production cutover window, rollback criteria, and three-day monitoring roster.

### Exchange only through an approved secure channel

- [ ] UAT web-service username and password.
- [ ] Production web-service username and password, issued separately from UAT.
- [ ] SFTP credentials or SSH public keys.
- [ ] Any client certificate material required by the final connectivity design; private keys remain under Zynotch control.
- [ ] Consumer test identifiers and evidence containing personal or financial data.

<!-- pagebreak -->

## Zynotch information sheet

### Network and base service details

| Field | UAT | Production | Owner/status |
|---|---|---|---|
| Public/NAT source IP | TO PROVIDE | TO PROVIDE | Zynotch Network |
| Private host/server IP | TO PROVIDE | TO PROVIDE | Zynotch Network |
| API hostname | TO PROVIDE | app.fintap.com - verify API routing before sharing | Zynotch Application |
| Port | 443 | 443 | Required |
| Inquiry URL | https://UAT-HOST/api/1.0/Payments/BillInquiry | https://app.fintap.com/api/1.0/Payments/BillInquiry - externally verify | Zynotch Application |

<!-- pagebreak -->

### Service endpoints and credentials

| Field | UAT | Production | Owner/status |
|---|---|---|---|
| Payment URL | https://UAT-HOST/api/1.0/Payments/BillPayment | https://app.fintap.com/api/1.0/Payments/BillPayment - externally verify | Zynotch Application |
| FetchBundle URL | https://UAT-HOST/v1/Transaction/Fetchbundle | https://app.fintap.com/v1/Transaction/Fetchbundle - only if confirmed in scope | Joint confirmation |
| TLS | TLS 1.2 or stronger | TLS 1.2 or stronger | Zynotch Security |
| Required cipher | TO CONFIRM from 1LINK highlighted screenshot | TO CONFIRM | 1LINK/Zynotch Security |
| CA certificate file | TO ATTACH | TO ATTACH | Zynotch Security |
| Web-service username | SECURE EXCHANGE | SECURE EXCHANGE | Zynotch Application |
| Web-service password | SECURE EXCHANGE | SECURE EXCHANGE | Zynotch Application |
| Technical support contact | TO PROVIDE | TO PROVIDE | Zynotch PM |
| Settlement contact | TO PROVIDE | TO PROVIDE | Zynotch Finance |

The paths above reflect the reviewed repository. Confirm DNS, reverse-proxy routing, certificate name, and an external request from the 1LINK network before treating them as final endpoints.

<!-- pagebreak -->

## 1LINK network information to record

| Requirement | Current information | Action |
|---|---|---|
| 1LINK source/peer 1 | 10.95.8.92 on port 443 | Confirm whether this is observed source, destination, or tunnel-private address. |
| 1LINK source/peer 2 | 10.95.8.94 on port 443 | Confirm primary/DR purpose and NAT behavior. |
| Connectivity | New connectivity required | Choose P2P fibre L2, MPLS L2, or approved Internet/IPsec design. |
| Resilience | Primary and DR via different providers with automatic switchover | Provide design and witnessed failover evidence. |
| Routing | Static routes toward 1LINK only | Supply route and ACL record. |
| Wireless | WiMAX/microwave and other wireless connectivity prohibited by supplied guideline | Confirm providers comply. |
| IPsec if Internet | IKEv2; AES-256; SHA-256; DH group 19; PFS, subject to final 1LINK profile | Exchange approved tunnel sheet. |
| Device posture | Current secure software, patches, ACLs, malware controls, Cisco compatibility where required | Supply compliance confirmation. |

Important clarification: the supplied network guideline says server connectivity must use private segments only, while the kickoff minutes ask Zynotch for both public and private IPs. Ask 1LINK to document the final topology, NAT points, and the addresses that the application must allowlist.

<!-- pagebreak -->

## API contract summary for confirmation

### Bill Inquiry

POST /api/1.0/Payments/BillInquiry

| Field | Direction | Reviewed constraint |
|---|---|---|
| username/password | Headers | Required; maximum 60 characters per supplied specification. Exchange securely. |
| consumer_number | Request | Numeric, 1 to 24 characters in this implementation. 1LINK note should confirm whether normal production maximum is 20. |
| bank_mnemonic | Request | Alphanumeric, maximum 8 characters. |
| reserved | Request | Optional, maximum 400 characters. |

#### Inquiry response fields

| Field | Direction | Reviewed constraint |
|---|---|---|
| response_Code | Response | Two-character business response. |
| consumer_detail | Response | Fixed 30-character, space-padded display value. |
| bill_status | Response | U unpaid, P paid, B blocked, T late/after due date. |
| due_date | Response | YYYYMMDD. |
| amount_within_duedate | Response | Numeric amount field, maximum 14 characters. |
| amount_after_duedate | Response | Numeric amount field, maximum 14 characters. |

<!-- pagebreak -->

### Bill Payment

POST /api/1.0/Payments/BillPayment

| Field | Direction | Reviewed constraint |
|---|---|---|
| consumer_number | Request | Numeric, 1 to 24 characters. |
| tran_auth_id | Request | Exactly 6 alphanumeric characters. |
| transaction_amount | Request | Numeric amount field, maximum 12 characters; must exactly match the amount due. |
| tran_date | Request | Exactly 8 digits, YYYYMMDD. |
| tran_time | Request | Exactly 6 digits, HHMMSS. |
| bank_mnemonic | Request | Alphanumeric, maximum 8 characters. |
| reserved | Request | Implementation accepts up to 515 characters because the detailed supplied layout totals 515; summary table says 400. 1LINK must confirm. |
| response_Code | Response | Two-character business response. |
| Identification_parameter | Response | Transaction/reference identifier. |

<!-- pagebreak -->

### FetchBundle — POST /v1/Transaction/Fetchbundle

| Field | Direction | Reviewed constraint |
|---|---|---|
| PCID | Request | Alphanumeric, 1 to 8 characters. |
| companyId | Response | Normalized PCID. |
| responseCode | Response | 00 success, 01 no data/not found, 04 invalid request, 05 service error. |
| billerName | Response | Maximum 30 characters. |
| bundleDetails | Response | Active bundles linked to the PCID/biller. |

The kickoff minutes mention Payment and Balance Inquiry; confirm whether FetchBundle is required for this invoice-only aggregator scope before exposing or testing it.

## Business response codes to confirm in UAT

| Code | Intended meaning in supplied REST material | Required evidence |
|---|---|---|
| 00 | Success | Inquiry and Payment success examples. |
| 01 | Consumer/data not found | Unknown consumer and unknown PCID. |
| 02 | Blocked/inactive consumer | Two blocked consumers. |
| 03 | Already paid/duplicate as applicable | Paid consumer and repeated payment. |
| 04 | Invalid request/data | Invalid lengths, formats, amount, or PCID. |
| 05 | System/service error | Controlled service-failure test agreed with 1LINK. |
| 06 | Additional summary code shown in supplied material | Ask 1LINK for endpoint-specific meaning and usage. |

Confirm whether business failures are always returned with HTTP 200 or with corresponding HTTP 4xx/5xx statuses. The application and 1LINK monitoring must agree on both layers.

## Required UAT consumer-number pack

1LINK requested 20 cases. Do not invent the amount slabs; obtain the seven slab boundaries first.

| Case group | Count | Preparation rule | Identifier/status |
|---|---:|---|---|
| Unpaid - slab 1 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Unpaid - slab 2 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Unpaid - slab 3 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Unpaid - slab 4 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Unpaid - slab 5 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Unpaid - slab 6 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Unpaid - slab 7 | 2 | One invoice per confirmed slab amount | TO PROVIDE |
| Paid | 2 | Invoice already settled; repeat inquiry/payment behavior recorded | TO PROVIDE |
| After due date | 1 | Due date elapsed; after-due amount/late fee verified | TO PROVIDE |
| Blocked | 2 | Consumer inactive/blocked; payment rejected | TO PROVIDE |
| 24-digit consumer | 1 | Controlled custom numeric identifier, unique and prefix-approved | TO PROVIDE |
| Total | 20 | Matches kickoff request | PENDING |

For each row record consumer number, tenant/biller, slab, base amount, late fee, due date, expected bill status, expected response code, and reset/reuse rule. Send the completed sheet securely and use synthetic identities.

## UAT execution and evidence checklist

- [ ] Connectivity from both 1LINK addresses to both Zynotch UAT nodes on 443.
- [ ] TLS 1.2 handshake, certificate chain, hostname, expiry, revocation posture, and exact cipher proof.
- [ ] Correct rejection of traffic from an unapproved source IP.
- [ ] Valid Inquiry for every unpaid slab, paid, late, blocked, unknown, and 24-digit case.
- [ ] Valid Payment for each agreed positive case with exact amount.
- [ ] Amount mismatch, malformed field, invalid credential, blocked consumer, paid consumer, and unknown consumer tests.
- [ ] Duplicate Payment using the same consumer number, authorization ID, date, and time; confirm no second ledger/transaction posting.
- [ ] Timeout and safe retry test; confirm idempotent financial state.
- [ ] Database evidence that invoice, payment, transaction, ledger, and organization state agree after each posting.
- [ ] Redacted request/response logs with timestamp, correlation/reference, HTTP status, business code, and latency.
- [ ] Primary-to-DR failover test and recovery result.
- [ ] Signed defect closure and 1LINK QA/certification approval.

Never include passwords, full API keys, private certificate keys, or unnecessary personal data in screenshots or logs.

<!-- pagebreak -->

## Settlement and SFTP readiness

### Access and transfer details

| Item | Required value/status |
|---|---|
| SFTP hostname and port | TO PROVIDE BY 1LINK |
| UAT and Production folders | TO PROVIDE BY 1LINK |
| Authentication | SSH public key preferred; TO AGREE |
| Source IP allowlists | TO EXCHANGE |

### File and operational controls

| Item | Required value/status |
|---|---|
| File naming and schema | TO PROVIDE BY 1LINK |
| Encryption/signature | TO AGREE |
| Availability time and time zone | TO AGREE |
| Duplicate/correction-file handling | TO AGREE |
| Retention and archive | TO AGREE |
| T+1 settlement calendar/cut-off | TO CONFIRM |
| UBL account/title/IBAN | TO PROVIDE SECURELY BY ZYNOTCH FINANCE |
| Reconciliation owner and SLA | TO PROVIDE |
| Break/dispute escalation | TO PROVIDE |

The reviewed application does not itself implement SFTP settlement ingestion/reconciliation. Assign this to a controlled operational process or build a monitored job with checksum validation, idempotent import, exception queue, and retained evidence before go-live.

<!-- pagebreak -->

## Questions requiring written 1LINK confirmation

1. What are the seven unpaid amount-slab boundaries and amount format/units?
2. Is the maximum production consumer number 20 digits while one UAT case must be 24 digits?
3. Is Payment reserved 400 characters or the 515 characters implied by the detailed layout?
4. What exact TLS cipher suite was highlighted in the missing/attached image?
5. Are 10.95.8.92 and 10.95.8.94 the addresses observed by the application, tunnel peers, or destination hosts? What NAT occurs?
6. How should the private-segment-only network rule be reconciled with the request for public and private Zynotch IPs?
7. Is FetchBundle in scope for Zynotch's invoice service?
8. What HTTP statuses accompany each business response code?
9. What are the timeout, retry, duplicate window, throughput, and availability/SLA requirements?
10. What time zone controls tran_date, tran_time, due date, settlement cut-off, and SFTP file availability?
11. What are the SFTP filename, schema, control totals, correction rules, encryption, and retention requirements?
12. Are reversal, refund, chargeback, or payment-status inquiry services required now or later?

<!-- pagebreak -->

## Go-live sign-off record

| Approval | Name | Date | Status/evidence |
|---|---|---|---|
| Zynotch Business Owner | TO PROVIDE | TO PROVIDE | PENDING |
| Zynotch Application Owner | TO PROVIDE | TO PROVIDE | PENDING |
| Zynotch Network/Security | TO PROVIDE | TO PROVIDE | PENDING |
| Zynotch Finance/Settlement | TO PROVIDE | TO PROVIDE | PENDING |
| 1LINK PMO | Darain Jamal / delegate | TO PROVIDE | PENDING |
| 1LINK Business Development | Aimen Habib Niazi / delegate | TO PROVIDE | PENDING |
| 1LINK QA/Certification | TO PROVIDE | TO PROVIDE | PENDING |

## Suggested cover email

Subject: Zynotch - 1BILL Aggregator UAT Prerequisites and Handover Pack - Prefix 105172

Dear 1LINK Team,

Further to the kickoff meeting of 4 September 2026, please find Zynotch PVT Limited's 1BILL Aggregator UAT handover package for invoice-based collections under prefix 105172. The package contains the completed scope forms, network details, CA certificate chain, API contract, test-consumer matrix, support contacts, and proposed UAT schedule. Credentials and consumer identifiers will be exchanged separately through the agreed secure channel.

Please confirm the open contract and network questions recorded in the handover pack, particularly the amount slabs, Payment reserved-field length, exact TLS cipher, observed source/NAT addresses, FetchBundle scope, and SFTP specification. Once confirmed, we will freeze the UAT configuration and schedule joint connectivity and functional testing.

Regards,

Khizar Khan

Zynotch PVT Limited
