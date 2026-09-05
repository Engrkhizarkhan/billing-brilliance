# Zynotch 1BILL Connectivity and REST API Submission

**From:** Zynotch PVT Limited  
**To:** 1LINK 1BILL Project and Network Teams  
**Date:** 5 September 2026  
**Service:** 1BILL Invoice Aggregator  
**Assigned prefix:** `105172`

This document provides the currently verified connectivity, HTTPS certificate, and REST API details requested for the Zynotch 1BILL onboarding. The web-service password and IPsec pre-shared key are intentionally excluded and must be exchanged through a separate secure channel.

## Details for TSR and connectivity

| Item | Zynotch value | Status or action |
|---|---|---|
| Public API hostname | `app.fintap.pk` | Active |
| Public IP | `178.238.236.126` | Active and resolves from the hostname |
| HTTPS application port | `TCP 443` | Active |
| VM private IP | Not assigned | The VM is single-homed and has only `178.238.236.126/24` on `eth0`. See the selector question below. |
| 1LINK application source IPs | `10.95.8.92/32`, `10.95.8.94/32` | Configured in the 1BILL API allowlist |
| 1LINK public IPsec peer | `103.248.140.4` | Taken from the supplied IKEv2 template dated 15 August 2025 |
| TLS versions | TLS 1.2 and TLS 1.3 | Verified on the public endpoint |
| SSL certificate | `app.fintap.pk-leaf.crt` | CA-authorized Let's Encrypt certificate; full chain is also supplied |
| Web-service username | `zynotch-1bill-prod` | Active |
| Web-service password | Shared separately through a secure channel | Do not send in the same email as this document |

### Required confirmation for the private or protected IP

The Contabo VM does not have an RFC1918 private address. Please confirm which traffic selector should be used in the TSR and IPsec policy:

1. use `178.238.236.126/32` as Zynotch's protected application host; or
2. assign and approve a mutually agreed private `/32` address for the tunnel and application listener.

Please also confirm the 1LINK protected subnet or individual host selectors. Based on the kickoff information, the expected 1LINK application hosts are `10.95.8.92/32` and `10.95.8.94/32`, but Zynotch will not assume that these are the final IPsec traffic selectors without 1LINK confirmation.

## REST API service

### Balance inquiry

**Method and URL**

```text
POST https://app.fintap.pk/api/1.0/Payments/BillInquiry
```

**Headers**

```text
Content-Type: application/json
username: zynotch-1bill-prod
password: <shared separately>
```

**Request body**

```json
{
  "consumer_number": "10517200000001",
  "bank_mnemonic": "KESC0001",
  "reserved": ""
}
```

**Success response shape**

```json
{
  "response_Code": "00",
  "consumer_detail": "CUSTOMER NAME                 ",
  "bill_status": "U",
  "due_date": "20260930",
  "amount_within_dueDate": "+0000000012000",
  "amount_after_dueDate": "+0000000012500",
  "billing_month": "2609",
  "date_paid": "",
  "amount_paid": "",
  "tran_auth_Id": "",
  "reserved": ""
}
```

`consumer_number` accepts numeric values up to 24 digits in the Zynotch service. The final 24-digit UAT case must be confirmed against any lower limit enforced by the 1LINK switch. `bank_mnemonic` is alphanumeric and up to 8 characters. `reserved` is optional and supports the agreed fixed-field layout.

### Payment posting

**Method and URL**

```text
POST https://app.fintap.pk/api/1.0/Payments/BillPayment
```

**Headers**

```text
Content-Type: application/json
username: zynotch-1bill-prod
password: <shared separately>
```

**Request body**

```json
{
  "consumer_number": "10517200000001",
  "tran_auth_id": "112233",
  "transaction_amount": "000000012000",
  "tran_date": "20260905",
  "tran_time": "143000",
  "bank_mnemonic": "KESC0001",
  "reserved": ""
}
```

`transaction_amount` is a 12-digit minor-unit value. For example, PKR 120.00 is sent as `000000012000`.

**Success response shape**

```json
{
  "response_Code": "00",
  "Identification_parameter": "CUSTOMER NAME",
  "reserved": ""
}
```

Authentication failures return HTTP `401` with a 1BILL-compatible response body. Valid authenticated requests return the business result in `response_Code`.

## IPsec parameters from the supplied template

The following values reproduce the supplied 1LINK template. The HTTPS TLS cipher and the IPsec encryption suite are different controls and should not be treated as the same setting.

| Parameter | Required value |
|---|---|
| IKE version | IKEv2 only |
| IKE Phase 1 encryption | AES-256-CBC |
| IKE Phase 1 authentication or integrity | SHA-256 |
| IKE Phase 1 DH group | Group 19 |
| IKE Phase 1 lifetime | 28,800 seconds |
| IPsec protocol | ESP |
| IKE Phase 2 encryption | AES-256-CBC |
| IKE Phase 2 authentication or integrity | SHA-256 |
| IKE Phase 2 PFS or DH group | Group 19 |
| IKE Phase 2 lifetime | 28,800 seconds |
| Authentication | Pre-shared key |
| 1LINK public peer | `103.248.140.4` |
| Zynotch public peer | `178.238.236.126` |
| 1LINK protected hosts proposed for confirmation | `10.95.8.92/32`, `10.95.8.94/32` |
| Zynotch protected host | Pending 1LINK confirmation as described above |
| Pre-shared key | Pending separate secure exchange |

For tunnel establishment, please confirm whether UDP `500`, UDP `4500` for NAT-T, and ESP protocol `50` are required and permitted on the 1LINK side. Zynotch will mirror the confirmed requirement.

## HTTPS certificate and cipher status

The supplied certificate details are:

| Field | Value |
|---|---|
| Subject | `CN=app.fintap.pk` |
| Issuer | `CN=YE1, O=Let's Encrypt, C=US` |
| Valid from | 8 July 2026 22:42:37 UTC |
| Valid until | 6 October 2026 22:42:36 UTC |
| SHA-256 fingerprint | `2E:B7:40:CF:BE:91:84:7F:B7:70:CD:DD:79:3F:31:E8:7B:3A:23:93:AA:C1:CB:3A:1A:52:68:EA:47:96:32:95` |

TLS 1.2 is enabled and was verified with `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`. TLS 1.3 is also enabled. The certificate uses an ECDSA key. Please confirm the exact HTTPS cipher required by 1LINK and whether an ECDSA Let's Encrypt certificate is accepted. The supplied IPsec document specifies the VPN cipher suite but does not specify the required HTTPS TLS cipher.

The certificate is automatically renewed and the leaf certificate will change. Please confirm whether 1LINK trusts the CA chain or pins the leaf certificate so certificate-renewal handling can be agreed before go-live.

## Current implementation verification

The following checks passed on 5 September 2026:

- `https://app.fintap.pk/api/health` returned HTTP `200`.
- A request from allowed source `10.95.8.92` with the active credential reached the inquiry controller.
- A request from a non-allowlisted source with the active credential returned HTTP `401`.
- The former default `demo-user` credential returned HTTP `401` even when tested from an allowed source.
- The deployed service remained online after credential rotation and allowlist enforcement.

## Items requested from 1LINK to complete the tunnel

Please provide or confirm the following so Zynotch can complete the IPsec configuration without conflicting assumptions:

1. final 1LINK protected network selectors, including whether both `10.95.8.92/32` and `10.95.8.94/32` are included;
2. the approved Zynotch protected host selector because the VM has no private address;
3. IPsec pre-shared-key ownership and secure exchange method;
4. the exact HTTPS TLS cipher required by the earlier highlighted-cipher instruction;
5. whether the current ECDSA CA-authorized certificate is accepted;
6. whether the current hostname is for initial connectivity only, UAT, or Production, since separate UAT and Production connections were requested at kickoff; and
7. the final UAT source or NAT IPs if they differ from `10.95.8.92` and `10.95.8.94`.

## Suggested covering message

Assalam-o-Alaikum,

Please find Zynotch's REST API, public IP, port, SSL certificate, and web-service username attached. The password will be shared separately through a secure channel.

Our public IP is `178.238.236.126` and the service is available on TCP port `443` at `app.fintap.pk`. The VM has no separate private IP, so please confirm whether `178.238.236.126/32` should be used as our protected host selector or whether 1LINK will approve a private tunnel address. We have configured `10.95.8.92` and `10.95.8.94` in the 1BILL application allowlist.

We have reviewed the IKEv2 template and recorded the Phase 1 and Phase 2 parameters. To complete the tunnel, please confirm the protected selectors, pre-shared-key exchange method, and exact HTTPS TLS cipher requirement.

Regards,  
Khizar Khan  
Zynotch PVT Limited
