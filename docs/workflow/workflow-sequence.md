# Billing Brilliance Workflow (Sequence View)

Last updated: 2026-04-05

Related workflow docs:

- Full Workflow: [workflow.md](./workflow.md)
- ETA Dashboard Workflow: [eta-dashboard-workflow.md](./eta-dashboard-workflow.md)

This is a compact visual companion to the full workflow in [workflow.md](./workflow.md).

ETA ownership boundary for this flow:

- ETA/ETEA source system owns student/applicant master data.
- This system acts as payment processor only.
- Store temporary payment records per application/payment request.
- Do not model permanent student ownership in the payment engine.

## 1. Login and Route Guard

```mermaid
sequenceDiagram
    actor User
    participant LoginPage
    participant mockApi
    participant authStore
    participant Router
    participant DashboardLayout

    User->>LoginPage: Submit email/password/role
    LoginPage->>mockApi: login(email, password, role)
    alt Valid credentials
        mockApi-->>LoginPage: user
        LoginPage->>authStore: setUser(user), setAuthenticated(true)
        LoginPage->>Router: navigate(/role)
        Router->>DashboardLayout: Render protected layout
    else Invalid credentials
        mockApi-->>LoginPage: error
        LoginPage-->>User: Show invalid credentials toast
    end

    DashboardLayout->>authStore: Check isAuthenticated + user
    alt Missing auth
        DashboardLayout->>Router: redirect(/login)
    else Auth present
        DashboardLayout-->>User: Show role portal
    end
```

## 2. Admin Setup Flow (Biller and Users)

```mermaid
sequenceDiagram
    actor Admin
    participant AdminUI as Admin Pages
    participant mockApi
    participant Data as In-memory Data

    Admin->>AdminUI: Create New Biller
    AdminUI->>mockApi: createBiller(payload)
    mockApi->>Data: Insert biller + billerCode
    mockApi-->>AdminUI: created biller
    AdminUI-->>Admin: Refresh biller table

    Admin->>AdminUI: Add User
    AdminUI->>mockApi: createUser(payload)
    mockApi->>Data: Insert user (+ default password if needed)
    mockApi-->>AdminUI: created user
    AdminUI-->>Admin: Refresh users table
```

## 3. School Payment Collection Flow

```mermaid
sequenceDiagram
    actor SchoolOperator as School User
    participant SchoolUI as School Payments Page
    participant OneBill as onebillService
    participant Recon as paymentReconciliation
    participant Data as In-memory Data
    participant Store as paymentStore
    participant RT as Realtime/Reports

    SchoolOperator->>SchoolUI: Enter consumer number
    SchoolUI->>OneBill: billInquiry(consumerNumber)
    OneBill-->>SchoolUI: Bill details
    SchoolUI-->>SchoolOperator: Show fee slip + QR

    SchoolOperator->>SchoolUI: Mark Paid via 1BILL
    SchoolUI->>OneBill: billPayment(request)
    OneBill-->>SchoolUI: Payment success/failure

    SchoolUI->>Recon: reconcileBillPayment(...)
    Recon->>Data: Update invoice/payment/transaction/audit
    Recon->>Store: notifyPaymentUpdate()
    Store-->>RT: version increment triggers recompute
    RT-->>SchoolOperator: Updated realtime feed and totals
```

## 4. ETA Application Payment Flow

```mermaid
sequenceDiagram
    actor EtaOps as ETA User
    participant EtaUI as ETA Payments Page
    participant Controller as etaPaymentController
    participant Data as In-memory Data
    participant Store as paymentStore
    participant Reports as ETA Realtime/Reports

    EtaOps->>EtaUI: Create payment for application
    EtaUI->>Controller: createPayment(request, securityContext)
    Controller->>Controller: assertSecurity(apiKey/ip/https)
    Controller->>Data: Create payment record + billId
    Controller->>Data: Store temporary payment record only
    Controller->>Store: notifyPaymentUpdate()
    Controller-->>EtaUI: payment + oneBillRequest payload

    EtaOps->>EtaUI: Process callback payload
    EtaUI->>Controller: processPaymentCallback(callback, securityContext)
    Controller->>Controller: Verify signature + idempotency
    Controller->>Data: Update payment/transaction/notification
    Controller->>Store: notifyPaymentUpdate()
    Controller-->>EtaUI: acknowledged + updated status

    Store-->>Reports: version increment triggers refresh
    Reports-->>EtaOps: Realtime, invoices, and reports updated
```

## 5. Shared State Refresh Pattern

```mermaid
sequenceDiagram
    participant AnyModule as Admin/School/ETA Action
    participant Data as In-memory Data
    participant Store as paymentStore.version
    participant Screens as Dependent Screens

    AnyModule->>Data: Mutate core arrays/records
    AnyModule->>Store: notifyPaymentUpdate()
    Store-->>Screens: version changed
    Screens->>Data: Recompute derived views
    Screens-->>AnyModule: Fresh UI state
```

## 6. SaaS Tenant Isolation Flow

```mermaid
sequenceDiagram
    actor TenantUser
    participant UI as School/ETA UI
    participant API as Backend API
    participant Auth as Auth and Claims
    participant DB as Tenant Data Store

    TenantUser->>UI: Request tenant data
    UI->>API: Send request with auth token
    API->>Auth: Validate role + tenant_id claim
    Auth-->>API: Tenant scope resolved
    API->>DB: Query with tenant filter (tenant_id)
    DB-->>API: Only matching tenant records
    API-->>UI: Tenant-scoped response

    TenantUser->>UI: Try cross-tenant resource ID
    UI->>API: Request foreign tenant resource
    API->>Auth: Validate ownership
    API-->>UI: Reject (forbidden/not found by policy)
```

## 7. Runtime Note

- This repository currently runs frontend-first with in-memory state.
- Most mutations are session-scoped unless explicitly stored (for example ETA security context in localStorage).
- OneBill defaults to mock mode unless environment flags switch it to live.
- ETA mock reference rows are demo fixtures; production ownership remains in source system.