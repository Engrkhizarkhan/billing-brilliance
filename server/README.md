# Billing Brilliance - Backend API

Production-ready Node.js + Express + MySQL backend for the Billing Brilliance multi-tenant education and ETEA payment platform.

## Quick Start

```bash
cd server

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secrets

# Run migration (creates all 23 tables)
npm run migrate

# Seed the database (demo data matching frontend)
npm run seed

# Start development server
npm run dev

# Start production server
npm start
```

## Architecture

```
server/
├── src/
│   ├── index.js                  # Express app entry point
│   ├── config/
│   │   ├── index.js              # Centralized config (env vars)
│   │   ├── database.js           # MySQL2 connection pool
│   │   └── logger.js             # Winston structured logging
│   ├── controllers/              # Business logic
│   │   ├── authController.js     # JWT login, refresh, logout
│   │   ├── userController.js     # User CRUD + school sub-users
│   │   ├── tenantController.js   # Tenant/biller management
│   │   ├── studentController.js  # Students, ledger, snapshots
│   │   ├── invoiceController.js  # Invoice lifecycle
│   │   ├── billingController.js  # 1LINK bill inquiry/payment
│   │   ├── applicantController.js # ETEA applicants
│   │   ├── postingController.js  # ETEA postings & services
│   │   ├── eteaPaymentController.js # ETEA payment system
│   │   ├── transactionController.js # Transaction records
│   │   ├── paymentController.js  # Payment history
│   │   ├── settingsController.js # Fee plans, heads, scholarships
│   │   ├── notificationController.js # Notifications
│   │   ├── auditController.js    # Audit trail
│   │   └── reportController.js   # Dashboard stats, trends
│   ├── middleware/
│   │   ├── auth.js               # JWT auth, RBAC, tenant scoping
│   │   ├── errorHandler.js       # Centralized error handling
│   │   ├── auditLog.js           # Audit trail middleware
│   │   ├── validate.js           # express-validator rules
│   │   └── handleValidation.js   # Validation result handler
│   ├── routes/                   # Express routers
│   └── db/
│       ├── migrations/           # SQL schema files
│       ├── migrate.js            # Migration runner
│       └── seed.js               # Database seeder
└── tests/
    └── api.test.js               # Integration tests
```

## Database Schema

23 tables with full relational integrity, indexes, and soft-delete support:

| Table | Description |
|-------|-------------|
| `tenants` | School/ETEA organizations (multi-tenant isolation) |
| `roles` | System roles (admin, school_admin, school_finance, etc.) |
| `permissions` | Granular permissions (16 resources × 4 CRUD) |
| `role_permissions` | Role-permission mapping |
| `users` | All platform users with role + tenant association |
| `user_roles` | User-role many-to-many |
| `students` | Student records with consumer numbers |
| `fee_heads` | Fee categories (Tuition, Transport, Lab, etc.) |
| `fee_plans` | Fee plan templates |
| `scholarships` | Scholarship definitions (% or fixed) |
| `student_scholarship_assignments` | Student-scholarship mapping |
| `invoices` | Monthly billing invoices |
| `transactions` | Payment transaction records |
| `ledger_entries` | Student financial ledger |
| `payments` | Bill payment records |
| `etea_postings` | ETEA entry test / job postings |
| `applicants` | ETEA applicant records |
| `services` | ETEA service definitions |
| `etea_payment_records` | ETEA payment lifecycle records |
| `etea_payment_notifications` | Payment status notifications |
| `callback_idempotency_log` | Webhook idempotency protection |
| `bill_bundles` | Fee bundle packages |
| `payment_plan_assignments` | Student fee plan assignments |
| `audit_logs` | Complete audit trail |
| `notifications` | User notifications |
| `settings` | Tenant key-value settings |
| `refresh_tokens` | JWT refresh token store |

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with email/password/role → JWT tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/profile` | Get current user profile |
| PUT | `/api/auth/change-password` | Change password |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | JWT | List users (paginated, filterable) |
| GET | `/api/users/:id` | JWT | Get user details |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/:id/status` | Admin | Update user status |
| PUT | `/api/users/:id/reset-password` | Admin | Reset user password |
| GET | `/api/users/school/:schoolRef` | JWT | List school sub-users |
| POST | `/api/users/school/sub-user` | JWT | Create school sub-user |
| DELETE | `/api/users/school/:id` | JWT | Delete school sub-user |

### Tenants (Admin Only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenants` | List all tenants |
| GET | `/api/tenants/:id` | Get tenant details |
| POST | `/api/tenants` | Create tenant (auto biller code) |
| PUT | `/api/tenants/:id` | Update tenant info |
| PUT | `/api/tenants/:id/status` | Update tenant status |

### Students
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/students` | List students (search, class, status filters) |
| GET | `/api/students/:id` | Get student details |
| POST | `/api/students` | Create student (auto consumer number) |
| PUT | `/api/students/:id/bus-service` | Update bus service settings |
| GET | `/api/students/:id/ledger` | Get student financial ledger |
| GET | `/api/students/:id/snapshot` | Get financial risk snapshot |

### Invoices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/invoices` | List invoices (status, search, biller filters) |
| GET | `/api/invoices/:id` | Get invoice details |
| POST | `/api/invoices` | Create invoice |
| PUT | `/api/invoices/:id/status` | Update invoice status |

### Billing (1LINK Integration)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/billing/inquiry` | API Key | Bill inquiry by consumer number |
| POST | `/api/billing/payment` | API Key | Post bill payment |
| GET | `/api/billing/bundles` | JWT | Fetch fee bundles |

### Applicants (ETEA)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/applicants` | List applicants (status, posting, search) |
| GET | `/api/applicants/:id` | Get applicant details |
| POST | `/api/applicants` | Create applicant |
| PUT | `/api/applicants/:id/assign-roll` | Assign roll number |
| PUT | `/api/applicants/:id/result` | Record test result |

### ETEA Postings & Services
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/etea/postings` | List all postings |
| GET | `/api/etea/postings/:id` | Get posting details |
| POST | `/api/etea/postings` | Create posting |
| PUT | `/api/etea/postings/:id/status` | Update posting status |
| GET | `/api/etea/services` | List services |
| POST | `/api/etea/services` | Create service |

### ETEA Payments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payments/create` | JWT + API Key | Create payment record |
| GET | `/api/payments/:applicationId` | JWT + API Key | Get payment status |
| POST | `/api/payment/callback` | Webhook sig | Payment callback (idempotent) |
| GET | `/api/payments` | JWT | List all payments |
| GET | `/api/payment-notifications` | JWT | List notifications |
| POST | `/api/payments/expire` | JWT | Expire overdue payments |
| GET | `/api/health` | Public | Health check |

### Transactions & Payments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions` | List transactions |
| GET | `/api/transactions/:id` | Get transaction details |
| GET | `/api/payment-history` | Payment history with student info |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/fee-plans` | List fee plans |
| GET | `/api/fee-heads` | List fee heads |
| GET | `/api/scholarships` | List scholarships |
| GET | `/api/students/:studentId/scholarships` | Student scholarship assignments |

### Reports
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/reports/dashboard` | JWT | Dashboard stats |
| GET | `/api/reports/collection-trend` | JWT | Monthly collection trend |
| GET | `/api/reports/platform-summary` | Admin | Platform-wide summary |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | User notifications |
| PUT | `/api/notifications/:id/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |

### Audit Logs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit-logs` | Paginated audit trail |

## Authentication

### JWT Token Flow
1. `POST /api/auth/login` → returns `accessToken` + `refreshToken`
2. Send access token: `Authorization: Bearer <token>`
3. When expired: `POST /api/auth/refresh` with refresh token
4. Logout: `POST /api/auth/logout` to revoke refresh token

### API Key Authentication
For external integrations (1LINK, 1Bill):
```
X-API-Key: <your-api-key>
```

### Webhook Signature
For ETEA payment callbacks:
```
X-Webhook-Signature: <hash>
X-Idempotency-Key: <unique-key>
```

Signature = hash of `billId|status|transactionId|paidAt|WEBHOOK_SECRET`

## Multi-Tenancy

- Every data table has a `tenant_id` column
- Middleware automatically scopes queries to the user's tenant
- Admin users can access all tenants via `X-Tenant-Id` header
- School users see only their school's data

## Consumer Number Format

```
{FINTECH_PREFIX}{billerCode}{14-digit-padded-sequence}
example: 123456100100000000000001
```

## Security Features

- JWT with token rotation (access + refresh)
- bcryptjs password hashing (12 rounds)
- Helmet HTTP security headers
- CORS with configurable origin
- Rate limiting (100 req/15min global, 20 req/15min for auth)
- HPP (HTTP Parameter Pollution) protection
- Input validation with express-validator
- SQL injection prevention (parameterized queries)
- Audit trail for all sensitive operations
- Webhook signature verification
- Idempotency protection for payment callbacks
- IP whitelisting for ETEA endpoints

## Environment Variables

See `.env.example` for all configurable values including:
- Database connection
- JWT secrets and expiry
- ETEA payment configuration
- 1Bill/OneBill integration
- Rate limiting
- CORS origin

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Database Commands

```bash
# Run migrations
npm run migrate

# Fresh migration (drops all tables first)
npm run migrate:fresh

# Seed database with demo data
npm run seed
```

## Seed Data

The seeder creates data matching the frontend mock data exactly:
- 5 tenants (Beacon House, City Grammar, ETEA KPK, Premier Academy, Peshawar University)
- 6 roles with 64 permissions (16 resources × 4 CRUD)
- 5 users (admin, school admin, ETEA manager, school finance, banned user)
- 50 students across 2 schools
- 4 fee plans, 7 fee heads, 10 scholarships
- 30 invoices, 20 transactions
- 4 ETEA postings, 5 services, 15 applicants
- 5 bill bundles, 10 audit logs

Default credentials:
- Admin: `admin@example.com` / `123456` (role: admin)
- School: `school@example.com` / `123456` (role: school)
- ETEA: `etea@example.com` / `123456` (role: etea)
