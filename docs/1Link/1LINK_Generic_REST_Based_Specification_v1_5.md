# Generic Online Message REST Based Specifications

**Version 1.5**  
**Authored by TPS**

---

## 1. Revision History

| Date | Version | Authored By | Revision Section | Description |
|------|---------|-------------|-----------------|-------------|
| March 2021 | 1.0 | Faizan Ahmed Siddiqui | Initial Draft | — |
| March 2022 | 1.1 | Ovais Tahir / Faizan Ahmed Siddiqui | Input parameters | Reserved field length updated; Due date format updated in response packet; Bill status section updated in Response string |
| April 08, 2022 | 1.2 | Faizan Ahmed Siddiqui | Input parameters | Bundle id added |
| April 14, 2022 | 1.3 | Faizan Ahmed Siddiqui | Input parameters | Fetch Bundle method added |
| May 9, 2022 | 1.4 | Faizan Ahmed Siddiqui | Input parameters | Bundle id length updated; Fetch bundle response code added |
| Apr 18, 2023 | 1.5 | Faizan Ahmed Siddiqui | Response Code | Inquiry Response Code Mapping Added |

---

## 2. Introduction

This document consists of the following three transactions, which are implemented through web service:

1. **Fetch Bundle**
2. **Inquiry**
3. **Payment**

---

## Transaction 1: Fetch Bundle

### Input Parameters

**URL:** `http://ip:port/v1/Transaction/Fetchbundle`  
**Method Type:** `POST`

#### Request Parameters

| Parameter | Description | Mandatory/Optional | Data Type |
|-----------|-------------|-------------------|-----------|
| PCID | Company UCID | M | String(8) — Company UCID Required |

#### Sample Request Body

```json
{
  "PCID": "MBLINK01"
}
```

---

### Response Parameters

| Parameter | Description | Mandatory/Optional | Data Type |
|-----------|-------------|-------------------|-----------|
| companyId | Company UCID | M | String (N) 8 |
| Response Code | Response code | M | String (N) 2 |
| BillerName | Biller Name | M | String (A) 30 |
| bundleDetails | Bundle detail list (see below) | M | List |

#### bundleDetails Object Fields

| Field | Description |
|-------|-------------|
| bundleId | Unique ID of the bundle |
| bundleName | Name of the bundle |
| description | Description of the bundle |
| expiryDate | Expiry date of the bundle |
| amount | Amount for the bundle |
| tag | Bundle tags/details — max length 2000, contains: Bundle Category, Validity, Bundle Detail, Additional Info, Reserved |

> **Note:** The `tag` field (max 2000 characters) is used to pass the following fields:
> - Bundle Category
> - Validity
> - Bundle Detail
> - Additional Info
> - Reserved

#### Sample Response Body

```json
{
  "companyId": "MBLINK01",
  "responseCode": "00",
  "billerName": "Mobilink APC Prepaid",
  "bundleDetails": [
    {
      "bundleId": "1212",
      "bundleName": "Weekly Plus",
      "description": "abc Weekly Plus",
      "expiryDate": "27-MAR-22",
      "amount": "230",
      "tag": "PrePaid, 7days, 'Onnet min' '30' ; 'ofnet min' '60'; 15min (1 am to 9pm), any data"
    },
    {
      "bundleId": "1678",
      "bundleName": "SuperCard",
      "description": "abc Super Card",
      "expiryDate": "27-MAR-22",
      "amount": "480",
      "tag": "PrePaid, 7days, 'Onnet min' '30' ; 'ofnet min' '60'; 15min (1 am to 9pm), any data"
    }
  ]
}
```

---

## Transaction 2: Inquiry

This transaction is required to check the validity of the transaction.

### Input Parameters

**URL:** `../api/1.0/Payments/BillInquiry`  
**Method Type:** `POST`

#### Request Parameters

| Parameter | Description | Mandatory/Optional | Data Type |
|-----------|-------------|-------------------|-----------|
| username | — | M | String, max length 60 (no whitespace padding if less than 60) |
| password | — | M | String, max length 60 (no whitespace padding if less than 60) |
| consumer_number | Consumer number | M | String, max length 24 (no whitespace padding if less than 24); **At 1LINK max string length is 20** |
| bank_mnemonic | Bank Mnemonic or UC Id | M | String(8) — e.g., BoK, QNB; UCID e.g., SSGC0001, UFONE003 |
| reserved | Reserved field | O | String (400) |

#### Inquiry Reserved Field Details

| Parameter | Data Type / Description |
|-----------|------------------------|
| Reserved | CNIC (13) + Account Id (28) + BundleID (100) + Supporting Information1 (100) + Supporting Information2 (144). If empty or less length, fields will be padded with spaces (fixed length). |

#### Request Headers

```
Header["username"] = "Test"
Header["password"] = "@bcd"
```

#### Sample Request Body

```json
{
  "consumer_number": "14211101052009",
  "bank_mnemonic": "KESC0001",
  "reserved": "something, special, string, can, be, send, into, it."
}
```

---

### Response Parameters

#### Success Response — HTTP Status: 200

| Parameter | Description | Mandatory/Optional | Data Type |
|-----------|-------------|-------------------|-----------|
| response_Code | Response code (see codes below) | M | String (N) 2 |
| consumer_detail | Consumer Name | M | String (A) 30 — left justified, right padded with spaces |
| bill_status | Bill status code | M | String (A) 1 |
| due_date | Due date | M | yyyyMMdd |
| amount_within_dueDate | Amount within due date | M | AN14 — last 2 digits are minor units, left padded with zeros. e.g., Amount 120.00 Rs → `+0000000012000` |
| amount_after_dueDate | Amount after due date | M | AN14 — same format as above |
| billing_month | Billing month | M | String N(4) — yyMM |
| date_paid | Date paid (if bill status is 'P', else whitespace) | C | String N(8) — yyyyMMdd |
| amount_paid | Amount paid (if bill status is 'P', else whitespace) | C | String N(12) — last 2 digits minor units, left padded with zeros |
| tran_auth_id | Transaction auth ID (if bill status is 'P', else whitespace) | C | String N(6) — e.g., 698243 |
| reserved | Reserved field | O | String (400) |

#### Response Code Values

| Code | Meaning |
|------|---------|
| 00 | Valid consumer number — exists in system and status is active |
| 01 | Invalid consumer number — does not exist |
| 02 | Valid consumer number — currently blocked/dormant/inactive |
| 03 | Unknown Error / Bad Transaction |
| 04 | Invalid Data |
| 05 | Processing Failed |

#### bill_status Values

| Value | Meaning |
|-------|---------|
| U | Unpaid bill — payment is allowed |
| P | Paid bill — further payment is not allowed |
| B | Blocked bill |
| T | Partial / Multiple / Excess payment (always sent by companies allowing excess payments) |

#### Sample Success Response Body

```json
{
  "response_Code": "00",
  "consumer_Detail": "MUHAMMAD FEROZ",
  "bill_status": "U",
  "due_date": "20210329",
  "amount_within_dueDate": "-0000000186900",
  "amount_after_dueDate": "+0000000202500",
  "billing_month": "0809",
  "date_paid": "20180301",
  "amount_paid": "000000202500",
  "tran_auth_Id": "202500",
  "reserved": "something, special, string, can, be, send, into, it."
}
```

#### Error Response — HTTP Status: 400, 404, 500, etc.

#### Inquiry Reserved Field Details (Response)

| Parameter | Data Type / Description |
|-----------|------------------------|
| Reserved | Total loan amount (C)(12) + Total outstanding amount (C)(12) + Fee Amount (C)(12) + Max Limit (C)(12) + Min Limit (C)(12) + Supporting Information 1 (C)(200) + Supporting Information 2 (C)(67). Fixed length fields — padded with spaces if empty or less length. |

---

## Transaction 3: Payment Transaction

### Input Parameters

**URL:** `../api/1.0/Payments/BillPayment`  
**Method Type:** `POST`

#### Request Parameters

| Parameter | Description | Mandatory/Optional | Data Type |
|-----------|-------------|-------------------|-----------|
| username | — | M | String, max length 60 (no whitespace padding if less than 60) |
| password | — | M | String, max length 60 (no whitespace padding if less than 60) |
| consumer_number (PK) | Consumer number | M | String, max length 24; **At 1LINK max string length is 20** |
| tran_auth_id (PK) | Transaction Authorization ID | M | String N(6) — e.g., 698243 |
| Transaction_amount | Credit Amount | M | String AN12 — last 2 digits minor units, left padded with zeros. e.g., Amount 120.00 Rs → `000000012000` |
| tran_date (PK) | Transaction Date | M | String N(8) — YYYYMMDD |
| tran_time (PK) | Transaction Time | M | String N(6) — HHMMSS |
| bank_mnemonic | Bank Mnemonic or UCID | M | String(8) — e.g., BoK, QNB; UCID e.g., SSGC0001, UFONE003 |
| Reserved | Reserved field | — | String (400) |

#### Payment Reserved Field Details

| Parameter | Data Type / Description |
|-----------|------------------------|
| Reserved | Payer CNIC (13) + City (30) + Province (20) + Account Id (28) + fromAccountType 2 N(X) + fromAccountTitle 30 AN(X) + BundleID (100) + Supporting Information 1 (100) + Supporting Information 2 (192). Fixed length fields — padded with spaces if empty or less length. |

#### Request Headers

```
Header["username"] = "Test"
Header["password"] = "@bcd"
```

#### Sample Request Body

```json
{
  "consumer_number": "14211101052009",
  "tran_auth_id": "112233",
  "transaction_amount": "000000012000",
  "tran_date": "20180911",
  "tran_time": "121366",
  "bank_mnemonic": "KESC0001",
  "reserved": "something, special, string, can, be, send, into, it."
}
```

---

### Response Parameters

#### Success Response — HTTP Status: 200

```json
{
  "response_Code": "00",
  "Identification_parameter": "MUHAMMAD FEROZ",
  "reserved": "something, special, string, can, be, send, into, it."
}
```

#### Error Response — HTTP Status: 400, 404, 500, etc.

| Parameter | Description | Mandatory/Optional | Data Type |
|-----------|-------------|-------------------|-----------|
| response_Code | Response code (see below) | M | N(2) |
| Identification_parameter | Voucher Number, Scratch Card Number, etc. | O | String Length: (20) |
| reserved | Reserved field — first 20 digits will be the serial number | O | String (400) |

#### Payment Response Codes

| Code | Meaning |
|------|---------|
| 00 | Success |
| 01 | Mobile number not found |
| 02 | Unknown error |
| 03 | Duplicate Transaction |
| 04 | Invalid Data |
| 05 | Processing Failed |

> **Note:** More response codes may be added where applicable.

#### Payment Reserved Field Details (Response)

| Parameter | Data Type / Description |
|-----------|------------------------|
| Reserved | Supporting Information 1 (200) + Supporting Information 2 (200). Fixed length fields — padded with spaces if empty or less length. |

---

## Response Code Summary

| Transaction Type | Response Code | Description |
|----------------|---------------|-------------|
| Inquiry | 00 | Successful Bill Inquiry |
| Inquiry | 01 | Consumer Number does not exist |
| Inquiry | 02 | Consumer Number Block |
| Inquiry | 03 | Unknown Error / Bad Transaction |
| Inquiry | 04 | Invalid Data (e.g., userid, password, Bank Mnemonic provided wrong) |
| Inquiry | 05 | Service Fail |
| Inquiry | 06 | Bill Already Paid |
| Payment | 00 | Successful Bill Payment |
| Payment | 01 | Consumer Number does not exist |
| Payment | 02 | Unknown Error / Bad Transaction |
| Payment | 03 | Duplicate Transaction |
| Payment | 04 | Invalid Data (e.g., userid, password, Bank Mnemonic provided wrong) |
| Payment | 05 | Service Fail |
| Payment | 06 | Bill Already Paid |
| Fetch bundle | 00 | Successful inquiry |
| Fetch bundle | 01 | Consumer Number does not exist |
| Fetch bundle | 04 | Invalid Data |
| Fetch bundle | 05 | Service Fail |

---

## Duplicate Transaction Handling

It is possible that a Web Service will receive the same payment transaction multiple times (duplicate transaction), so it is necessary that the Web Service should be able to handle duplicate transactions. A bill payment transaction can be identified as unique by using the following fields:

1. `Consumer_Number`
2. `Tran_Auth_Id`
3. `Tran_Date`
4. `Tran_Time`

---

## HTTP Response Codes

| Status | Description |
|--------|-------------|
| 200 | Approve Response Code |
| 400 | Bad Request / Invalid Information |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

*© TPS — All rights reserved*
