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
| Existing Contabo private IP | `10.0.0.1/22` | Unchanged |
| Dedicated 1LINK protected IP | `172.29.250.10/32` | Active and persistent on loopback |
| 1LINK application source IPs | `10.95.8.92/32`, `10.95.8.94/32` | Configured in the 1BILL API allowlist |
| 1LINK public IPsec peer | `103.248.140.4` | Taken from the supplied IKEv2 template dated 15 August 2025 |
| TLS versions | TLS 1.2 and TLS 1.3 | Verified on the public endpoint |
| SSL certificate | `app.fintap.pk-leaf.crt` | CA-authorized Let's Encrypt certificate; full chain is also supplied |
| Web-service username | `1bill-user` | Active |
| Web-service password | Shared separately through a secure channel | Do not send in the same email as this document |

### IPsec protected addresses

Zynotch has configured the dedicated protected address `172.29.250.10/32`. The existing Contabo private network `10.0.0.0/22` is not included in the 1LINK tunnel. The configured 1LINK protected hosts are `10.95.8.92/32` and `10.95.8.94/32`.

## REST API service

### Balance inquiry

**Method and URL**

```text
POST https://app.fintap.pk/api/1.0/Payments/BillInquiry
```

**Headers**

```text
Content-Type: application/json
username: 1bill-user
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
username: 1bill-user
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
| Zynotch protected host | `172.29.250.10/32` |
| Pre-shared key | Received from 1LINK and stored securely; intentionally excluded from this document |

For tunnel establishment, please confirm whether UDP `500`, UDP `4500` for NAT-T, and ESP protocol `50` are required and permitted on the 1LINK side. Zynotch will mirror the confirmed requirement.

## HTTPS certificate and cipher status

The supplied certificate details are:

| Field | Value |
|---|---|
| Subject | `CN=app.fintap.pk` |
| Issuer | `CN=YE1, O=Let's Encrypt, C=US` |
| Valid from | 5 September 2026 19:19:27 UTC |
| Valid until | 4 December 2026 19:19:26 UTC |
| SHA-256 fingerprint | `FE:D9:1B:40:C2:C4:C9:4B:5E:8F:69:89:41:99:86:55:A6:1D:FC:6B:2D:17:40:18:35:66:7F:39:A6:47:FB:52` |

TLS 1.2 is enabled and was verified with `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`. TLS 1.3 is also enabled. The certificate uses an ECDSA key. Please confirm the exact HTTPS cipher required by 1LINK and whether an ECDSA Let's Encrypt certificate is accepted. The supplied IPsec document specifies the VPN cipher suite but does not specify the required HTTPS TLS cipher.

The certificate is automatically renewed and the leaf certificate will change. Please confirm whether 1LINK trusts the CA chain or pins the leaf certificate so certificate-renewal handling can be agreed before go-live.

## Current implementation verification

The following checks passed through 7 September 2026:

- `https://app.fintap.pk/api/health` returned HTTP `200`.
- A request from allowed source `10.95.8.92` with the active credential reached the inquiry controller.
- A request from a non-allowlisted source with the active credential returned HTTP `401`.
- Invalid credentials returned HTTP `401` even when tested from an allowed source.
- All 20 synthetic UAT consumers returned their expected Inquiry response code and bill status.
- Organization payment creation with `neverExpires` returned HTTP `201` after correcting MySQL date formatting.
- The organization dashboard returned HTTP `200` under strict MySQL mode.
- StrongSwan is active and both `onebill-92` and `onebill-94` are loaded.
- The dedicated protected address `172.29.250.10/32` is active and persistent.
- UDP ports `500` and `4500` are listening.
- IKEv2 requests leave `178.238.236.126:500` for `103.248.140.4:500`, but no response is received.
- No IKE SA or CHILD SA is currently established.

## Items requested from 1LINK to complete the tunnel

Please provide or confirm the following so Zynotch can complete the IPsec configuration without conflicting assumptions:

1. activate or verify the 1LINK VPN peer at `103.248.140.4`;
2. whitelist the Zynotch public VPN IP `178.238.236.126` for IKEv2;
3. confirm that UDP `500` and UDP `4500` can reach the 1LINK peer;
4. confirm the mirrored selectors: Zynotch `172.29.250.10/32` and 1LINK `10.95.8.92/32`, `10.95.8.94/32`;
5. confirm whether 1LINK or Zynotch should initiate the tunnel;
6. provide a coordinated packet-capture and tunnel-test window; and
7. after the peer responds, confirm the HTTPS cipher and certificate requirements for API UAT.

## Suggested covering message

Assalam-o-Alaikum,

Please find Zynotch's REST API, public IP, port, SSL certificate, and web-service username attached. The password will be shared separately through a secure channel.

Our public VPN IP is `178.238.236.126`, our dedicated protected IP is `172.29.250.10/32`, and the service is available on TCP port `443` at `app.fintap.pk`. We have configured `10.95.8.92` and `10.95.8.94` in the 1BILL application allowlist and IPsec CHILD selectors.

Our peer sends IKEv2 `IKE_SA_INIT` packets from `178.238.236.126:500` to `103.248.140.4:500`, but no packets return from the 1LINK peer. Please verify that the 1LINK VPN configuration is active and our public IP is whitelisted, then provide a coordinated retest window.

Regards,  
Khizar Khan  
Zynotch PVT Limited
