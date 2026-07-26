# Modern POS SaaS - Backend

Enterprise-grade Point of Sale system backend with multi-tenant support, licensing, and payment integration.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update the following variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `ADYEN_API_KEY`: Adyen API key
- `SENDGRID_API_KEY`: SendGrid API key

### 3. Setup Database

```bash
# Generate migrations
npm run db:migrate

# Push schema to database
npm run db:push

# View database in Drizzle Studio
npm run db:studio
```

### 4. Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:3000`

## API Endpoints

### Authentication

#### Register Merchant
```
POST /api/auth/merchant/register
Content-Type: application/json

{
  "email": "merchant@example.com",
  "password": "secure_password",
  "name": "John Doe",
  "businessName": "My POS Business"
}
```

#### Login Merchant
```
POST /api/auth/merchant/login
Content-Type: application/json

{
  "email": "merchant@example.com",
  "password": "secure_password"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "merchant": {
    "id": "uuid",
    "email": "merchant@example.com",
    "name": "My POS Business",
    "status": "active"
  }
}
```

#### Login Superadmin
```
POST /api/auth/superadmin/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "secure_password"
}
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

#### Change Password
```
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "new_secure_password"
}
```

### Licensing

#### Register Device
```
POST /api/licensing/device/register
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "deviceName": "Main POS Terminal",
  "deviceType": "mobile",
  "osVersion": "14.0",
  "appVersion": "1.0.0"
}

Response:
{
  "success": true,
  "device": {
    "id": "uuid",
    "deviceId": "POS-M123ABC-D456EFG-1720000000",
    "deviceName": "Main POS Terminal",
    "deviceType": "mobile"
  },
  "license": {
    "id": "uuid",
    "licenseKey": "M123ABC-D456EFG-7K9M2P-2025",
    "licenseType": "trial",
    "expiresAt": "2025-07-18T00:00:00Z",
    "status": "active"
  }
}
```

#### Activate License
```
POST /api/licensing/activate
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "deviceId": "POS-M123ABC-D456EFG-1720000000",
  "licenseCode": "M123ABC-D456EFG-7K9M2P-2025"
}

Response:
{
  "success": true,
  "message": "License activated successfully",
  "license": {
    "id": "uuid",
    "status": "active",
    "expiresAt": "2025-07-18T00:00:00Z"
  }
}
```

#### Check License Status
```
GET /api/licensing/status?deviceId=POS-M123ABC-D456EFG-1720000000
Authorization: Bearer <merchant_token>

Response:
{
  "isValid": true,
  "daysRemaining": 365,
  "expiresAt": "2025-07-18T00:00:00Z",
  "licenseType": "yearly"
}
```

#### Get All Licenses
```
GET /api/licensing/licenses
Authorization: Bearer <merchant_token>

Response:
{
  "success": true,
  "licenses": [
    {
      "id": "uuid",
      "licenseKey": "M123ABC-D456EFG-7K9M2P-2025",
      "licenseType": "yearly",
      "status": "active",
      "expiresAt": "2025-07-18T00:00:00Z",
      "device": {
        "deviceId": "POS-M123ABC-D456EFG-1720000000",
        "deviceName": "Main POS Terminal"
      }
    }
  ]
}
```

#### Renew License
```
POST /api/licensing/renew
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "deviceId": "POS-M123ABC-D456EFG-1720000000"
}

Response:
{
  "success": true,
  "license": {
    "id": "uuid",
    "licenseKey": "M123ABC-D456EFG-9X2Y5Z-2026",
    "status": "active",
    "expiresAt": "2026-07-18T00:00:00Z"
  },
  "licenseCode": "M123ABC-D456EFG-9X2Y5Z-2026"
}
```

## Database Schema

### Core Tables

- **superadmins**: Superadmin accounts
- **merchants**: Merchant accounts (tenants)
- **devices**: POS devices registered by merchants
- **licenses**: License records for devices
- **license_transactions**: Payment transactions for licenses
- **vat_settings**: VAT configuration per merchant
- **categories**: Product categories
- **products**: Product inventory
- **customers**: Customer records
- **orders**: Sales orders (POS + Web Shop)
- **order_items**: Line items in orders
- **payment_terminals**: Adyen payment terminals
- **payment_transactions**: Payment processing records
- **loyalty_cards**: RFID loyalty/gift cards
- **loyalty_transactions**: Loyalty card transactions
- **daily_reports**: Daily sales analytics

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

Tokens are valid for 24 hours (configurable via `JWT_EXPIRY`).

## Multi-Tenancy

The backend implements multi-tenant architecture:

1. Each merchant is a separate tenant
2. All data is isolated by `merchant_id`
3. Merchants can only access their own data
4. Superadmin can access all merchant data

## Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
```

### Production Start
```bash
npm run start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Optional |
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `JWT_EXPIRY` | JWT token expiry time | `24h` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `ADYEN_API_KEY` | Adyen API key | Optional |
| `ADYEN_MERCHANT_ACCOUNT` | Adyen merchant account | Optional |
| `SENDGRID_API_KEY` | SendGrid API key | Optional |
| `SENDGRID_FROM_EMAIL` | SendGrid from email | Optional |

## Architecture

### Services
- **AuthService**: User authentication and JWT management
- **LicensingService**: Device registration and license management

### Middleware
- **verifyToken**: JWT token verification
- **requireSuperadmin**: Superadmin role check
- **requireMerchant**: Merchant role check
- **verifyMerchantAccess**: Merchant data isolation
- **setMerchantContext**: Set merchant context from JWT

### Database
- **Drizzle ORM**: Type-safe database queries
- **PostgreSQL**: Primary database
- **Migrations**: Version-controlled schema changes

## Next Steps

1. ✅ Database schema and licensing system
2. ⏳ Superadmin dashboard backend
3. ⏳ Merchant dashboard backend
4. ⏳ Web shop integration
5. ⏳ Adyen payment integration
6. ⏳ Loyalty program backend
7. ⏳ Email notifications
8. ⏳ Analytics and reporting

## Support

For issues or questions, please refer to the main project documentation.

---

**Version**: 1.0.0  
**Last Updated**: 2026-07-11
