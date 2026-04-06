# 1LINK 1BILL — Bill Payment System

*All Rights Reserved — 1LINK (Pvt) Limited*

---

## 1BILL — Unveiling 1BILL as a Product

**1BILL** is a comprehensive bill payment solution designed to make payment collections through multiple channels:

- **ADC** — Alternate Delivery Channels
- **OTC** — Over The Counter Channels

### Transactions Offered by 1LINK 1BILL

1. **Bill Payment**
2. **Bill Inquiry**

### Payment Types Supported

```
┌─────────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  INVOICE BASED      │  │  VARIABLE / PARTIAL       │  │  CREDIT CARD     │  │  PACKAGES &          │
│  PAYMENTS           │  │  PAYMENTS & TOP UP        │  │  BILLS           │  │  BUNDLES             │
└─────────────────────┘  └──────────────────────────┘  └──────────────────┘  └──────────────────────┘
```

---

## High Level Flow of 1BILL

```
┌──────────┐       ┌─────────────────────────┐       ┌──────────┐       ┌──────────┐
│          │       │         BANK            │       │          │       │          │
│ CUSTOMER │──────►│  OTC / ATM /            │──────►│  1LINK   │──────►│  BILLER  │
│          │       │  Internet Banking /      │       │          │       │          │
└──────────┘       │  Mobile Banking /        │       └──────────┘       └──────────┘
                   │  NADRA E-SAHULAT Agents  │
                   └─────────────────────────┘
```

> The customer initiates a transaction through their bank's channel. The bank forwards it to 1LINK, which routes it to the relevant biller.

---

## 1LINK 1BILL — Bill Inquiry

1LINK 1BILL provides a **bill inquiry transaction** for billing partners from where their customers can fetch details against a given PSID/Voucher number. The result is reflected on the digital channel upon a successful response.

### Bill Inquiry Flow

```
                               ◄──── Fetching Bill Information ────►
                         
  ┌──────────┐    ①       ┌─────────────────────────┐    ③     ┌──────────┐    ④    ┌────────┐
  │          │            │                         │          │          │          │        │
  │ CUSTOMER │──②─────►  │    BANKING CHANNEL      │─────────►│  1BILL   │─────────►│ BILLER │
  │          │            │    (Bank / ATM / App)   │    ⑥    │          │    ⑤    │        │
  │  PSID    │            │       Acquiring Bank    │◄─────────│          │◄─────── │        │
  │  against │            └─────────────────────────┘          └──────────┘          └────────┘
  │ Booking  │
  │          │    ⑦
  │          │◄──────────────────────────────────────────────────────────────
  │          │       Customer displayed with bill information
  └──────────┘
                         ◄──── Returning Bill Information ────►
```

**Steps:**
1. Customer has a PSID/Voucher against their booking
2. Customer enters PSID on banking channel
3. Bank sends Bill Inquiry to 1BILL
4. 1BILL forwards request to the Biller
5. Biller returns bill information to 1BILL
6. 1BILL returns bill details to acquiring bank
7. Customer is displayed with the bill information

---

## 1LINK 1BILL — Bill Payment

1LINK 1BILL provides a **bill payment transaction** to customers for payments against PSID/Vouchers upon successful payment inquiry. On successful payment, 1LINK performs **settlements** with the billing partners.

### Bill Payment Flow

```
                     PAYMENT INITIATION                          PAYMENT PROCESSING
                         
  ┌──────────┐    ①    ┌──────────────────────────┐    ③     ┌──────────┐    ④    ┌────────┐
  │          │         │                          │          │          │          │        │
  │ CUSTOMER │──②────► │    BANKING CHANNEL       │─────────►│  1BILL   │─────────►│ BILLER │
  │          │         │    (Bank / ATM / App)    │    ⑥    │          │    ⑤    │        │
  │  PSID    │         │       Acquiring Bank     │◄─────────│          │◄─────── │        │
  │  against │         └──────────────────────────┘          └──────────┘          └────────┘
  │ Booking  │
  └──────────┘

                              PAYMENT ACKNOWLEDGEMENT
                    Acknowledgement of payment provided back
                         to the banking channel by 1LINK
```

---

## 1BILL Customer's Journey on Banking Channels (ADCs)

```
  ┌─────────────┐   ┌─────────────────┐   ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
  │      ①      │   │       ②         │   │      ③       │   │        ④         │   │        ⑤         │
  │  LOGIN      │   │  PAYMENT MODE   │   │    BILL      │   │  FETCH BILLING   │   │   PERFORM        │
  │  SCREEN     │   │  SELECTION      │   │  INQUIRY     │   │  DETAILS         │   │   TRANSACTION    │
  │             │   │                 │   │              │   │                  │   │                  │
  │  Login ID   │   │  Bill Payments  │   │  Consumer    │   │  Consumer Name:  │   │  Consumer Name:  │
  │  Password   │   │  (Water, Gas,   │   │  Number:     │   │  AHMED KHAN      │   │  AHMED KHAN      │
  │             │   │   Electricity,  │   │  99955512345 │   │                  │   │                  │
  │  [Sign In]  │   │   Phone, etc.)  │   │  2342        │   │  Amount: 50,000  │   │  Amount: 50,000  │
  │             │   │                 │   │              │   │  Due: 11-25-22   │   │                  │
  │  Biometric  │   │  [1BILL]        │   │  [NEXT]      │   │  [PROCEED TO PAY]│   │ PAYMENT          │
  │  Login      │   │                 │   │              │   │                  │   │ SUCCESSFUL ✓     │
  └─────────────┘   └─────────────────┘   └──────────────┘   └──────────────────┘   └──────────────────┘
```

---

## 1BILL Customer's Journey Over The Counter (OTC)

```
  ┌─────────────┐   ┌─────────────────┐   ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
  │      ①      │   │       ②         │   │      ③       │   │        ④         │   │        ⑤         │
  │  CUSTOMER   │   │  TELLER         │   │    BILL      │   │  FETCH BILLING   │   │   PAYMENT        │
  │  WALKS IN   │   │  INITIATES      │   │  INQUIRY     │   │  DETAILS         │   │   COMPLETED      │
  │             │   │  BILL INQUIRY   │   │              │   │                  │   │                  │
  │  Customer   │   │                 │   │  Consumer    │   │  Consumer Name:  │   │  Consumer Name:  │
  │  arrives at │   │  Bank teller    │   │  Number:     │   │  AHMED KHAN      │   │  AHMED KHAN      │
  │  branch     │   │  initiates the  │   │  11178612345 │   │                  │   │                  │
  │             │   │  inquiry on     │   │  678912      │   │  Amount: 50,000  │   │  Amount: 50,000.23│
  │             │   │  system         │   │              │   │  Due: 11-25-22   │   │                  │
  │             │   │                 │   │  [NEXT]      │   │  [PROCEED TO PAY]│   │ PAYMENT          │
  │             │   │                 │   │              │   │                  │   │ SUCCESSFUL       │
  │             │   │                 │   │              │   │                  │   │ [PRINT RECEIPT]  │
  └─────────────┘   └─────────────────┘   └──────────────┘   └──────────────────┘   └──────────────────┘
```

---

## 1BILL Aggregation

---

### What is 1BILL?

1LINK introduced 1BILL, a comprehensive bill payment solution designed to make payment collections through banking channels:

- **ADC** — Alternate Delivery Channels
- **OTC** — Over The Counter Channels

#### High Level Flow

```
┌──────────┐       ┌──────────────────────┐       ┌──────────┐       ┌──────────┐
│          │       │        BANK          │       │          │       │          │
│ CUSTOMER │──────►│  OTC / ATM /         │──────►│  1LINK   │──────►│  BILLER  │
│          │       │  Internet Banking /  │       │          │       │          │
└──────────┘       │  Mobile Banking      │       └──────────┘       └──────────┘
                   └──────────────────────┘
```

---

### What is 1BILL Aggregation?

1LINK has improvised 1BILL services to benefit aggregators with the **1BILL Aggregation Model**. 1BILL Aggregation is best fit for billers that are partnered with their sub billers for their payment collections through banking channels (ADC and OTC).

#### 1BILL Aggregation Flow

```
                                                           ┌─────────┐
                                              ┌───────────►│ Partner │
                                              │  Payment   └─────────┘
                    Payment                   │
  ┌──────────┐   Order Request   ┌──────┐  Order Info  ┌─────────────┐  Payment  ┌─────────┐
  │          │──────────────────►│      │─────────────►│             │──────────►│ Partner │
  │ CUSTOMER │                   │1BILL │  Confirmation│  AGGREGATOR │           └─────────┘
  │          │◄──────────────────│      │◄─────────────│             │
  └──────────┘     Service       └──────┘              │             │  Info     ┌─────────┐
                                                       │             │◄─────────►│ Partner │
                                                       └─────────────┘ Sync      └─────────┘
```

---

### Key Benefits of 1BILL Aggregation

- **Ease of information exchange**
- **Comparing different products quality and price**
- **Trusted partnerships**
- **Secured transactions**
- **1STOP purchase**
- **Quality comparison**

---

### 1BILL Aggregation Onboarding Process

```
  ┌─────────┐                                                                  
  │ Partner │──┐                                                               
  └─────────┘  │   Scope Discussion /    ┌─────┐  ② Document Review   ③ Project Phases         ④
  ┌─────────┐  │   Business Requirements │     │    & Verification  ┌──────────────────┐  ┌─────────┐
  │ Partner │──┤①──────────────────────►│1LINK│──2a───────────────►│ 3a Network       │  │         │
  └─────────┘  │                         │     │                    │    Connectivity  │─►│ GO LIVE │
  ┌─────────┐  │                         │     │──2b───────────────►│ 3b Testing       │  │         │
  │ Partner │──┘   Aggregator submits    └─────┘  Commercials SOC  │ 3c QA Report     │  └─────────┘
  └─────────┘                                                       └──────────────────┘
       ▲
  AGGREGATOR
```

**Phase Descriptions:**

| Phase | Step | Description |
|-------|------|-------------|
| ① | Initiation | Aggregator (with Partners) submits Scope Discussion / Business Requirements to 1LINK |
| ② 2a | Documentation | Document Review & Verification |
| ② 2b | Commercial | Commercials go ahead as per SOC |
| ③ 3a | Technical | Network Connectivity |
| ③ 3b | QA | Testing |
| ③ 3c | QA | QA Report |
| ④ | Launch | Go Live |

---

### Aggregator Onboarding Steps

1. Customer connects to 1LINK
2. 1LINK business team understands customer's business nature and discusses the scope
3. Once both parties are on the same page, 1LINK team conveys the commercials and takes a go ahead from the customer
4. 1LINK provides NDA and takes customer's sign off
5. 1LINK gives customer an onboarding documents checklist to complete *(Meanwhile all the required agreements are being conveyed to customer parallelly for authorized signatories)*
6. Legal team verifies the documents after submission
7. On successful verification of documents, legal team gives green signal for project initiation
8. 1LINK raises Fact Sheet & Project Request Form (Scope, products, 6-digits prefix & agreed commercials) and gives it to Finance & Project Management Office respectively
9. PMO initiates the project followed by building connectivity with networks and on successful establishment, performs necessary testing before going live
10. On finalization and successful testing, project is put live
11. After confirmation from customer, project is closed with **3 days post live monitoring**

---

### Bifurcation of Involved Parties

```
                         ┌──────────────────────────────────┐
                         │            CUSTOMER              │
                         └──────────────────┬───────────────┘
                                            │  Payment
                                            ▼
                         ┌──────────────────────────────────┐
                         │             1BILL                │  ◄─── Rs
                         └──────────────────┬───────────────┘
                                            │  Payment
                                            ▼
                         ┌──────────────────────────────────┐
                         │           AGGREGATOR             │  ◄─── Rs
                         └──────┬───────────┬───────────────┘
                                │           │         │
                           Rs ▼      Rs ▼     Rs ▼
                        ┌──────────┐ ┌──────────┐ ┌──────────┐
                        │ Partner  │ │ Partner  │ │ Partner  │
                        └──────────┘ └──────────┘ └──────────┘
                               AGGREGATOR PARTNERS
```

**Roles and Responsibilities:**

| Party | Responsibility |
|-------|---------------|
| Aggregators | Sign contracts with partners |
| Aggregators | Connect to 1BILL service and bring their Partners to 1BILL services |
| 1BILL | Makes these services available to customers on ADC / OTC channels |
| Partners | Partners and their services are liable to aggregators |
| 1LINK | Ensures the availability of transactional and informational availability |

---

### Aggregation Business Model

The aggregator business model is a platform where the **leading entity doesn't produce or store any product/services**. However, on behalf of its partners, it leads with their information of services/goods and connects their customers at **one stop**.

#### Benefits

| Customers | Aggregator | Partners |
|-----------|------------|----------|
| Easy comparison | Convenient pipeline | Market availability |
| Multiple Choices | Quick information access | Customer awareness |
| One stop purchase | Increased revenue | Quick settlement |

---

*All Rights Reserved — 1LINK (Pvt) Limited*
