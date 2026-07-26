# Superadmin API Documentation

Complete API reference for superadmin dashboard endpoints.

## Authentication

All superadmin endpoints require JWT token in Authorization header:

```
Authorization: Bearer <superadmin_token>
```

Obtain token via:
```
POST /api/auth/superadmin/login
{
  "email": "admin@example.com",
  "password": "password"
}
```

---

## Merchant Management

### Get All Merchants

```
GET /api/superadmin/merchants?page=1&limit=20&search=query
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name or email

**Response:**
```json
{
  "success": true,
  "merchants": [
    {
      "id": "uuid",
      "name": "Business Name",
      "email": "merchant@example.com",
      "status": "active",
      "subscriptionPlan": "professional",
      "createdAt": "2025-07-11T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Get Merchant Details

```
GET /api/superadmin/merchants/:merchantId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "merchant": {
    "id": "uuid",
    "name": "Business Name",
    "email": "merchant@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "status": "active",
    "subscriptionPlan": "professional",
    "trialEndsAt": null,
    "subscriptionEndsAt": "2026-07-11T00:00:00Z",
    "devices": [...],
    "licenses": [...],
    "orders": [...]
  }
}
```

### Create Merchant

```
POST /api/superadmin/merchants
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newmerchant@example.com",
  "password": "secure_password",
  "businessName": "New Business",
  "contactName": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "New York",
  "country": "USA"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Merchant created successfully",
  "merchant": {
    "id": "uuid",
    "email": "newmerchant@example.com",
    "name": "New Business",
    "status": "trial",
    "trialEndsAt": "2025-07-18T00:00:00Z"
  }
}
```

### Update Merchant

```
PUT /api/superadmin/merchants/:merchantId
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+1234567890",
  "address": "456 Oak Ave",
  "city": "Boston"
}
```

### Suspend Merchant

```
POST /api/superadmin/merchants/:merchantId/suspend
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Violation of terms"
}
```

### Reactivate Merchant

```
POST /api/superadmin/merchants/:merchantId/reactivate
Authorization: Bearer <token>
```

### Get Merchant Analytics

```
GET /api/superadmin/merchants/:merchantId/analytics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "analytics": {
    "merchant": {
      "id": "uuid",
      "name": "Business Name",
      "email": "merchant@example.com",
      "status": "active",
      "subscriptionPlan": "professional",
      "createdAt": "2025-01-15T00:00:00Z"
    },
    "analytics": {
      "totalOrders": 150,
      "totalRevenue": 25000.50,
      "deviceCount": 3,
      "activeLicenses": 3,
      "trialEndsAt": null,
      "subscriptionEndsAt": "2026-07-11T00:00:00Z"
    }
  }
}
```

### Upgrade Subscription

```
POST /api/superadmin/merchants/:merchantId/upgrade
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan": "enterprise"
}
```

**Plan Options:** `starter`, `professional`, `enterprise`

---

## License Management

### Generate License

```
POST /api/superadmin/licenses/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "merchantId": "uuid",
  "deviceId": "uuid",
  "licenseType": "yearly",
  "customDays": null
}
```

**License Types:**
- `trial`: 7-day trial
- `yearly`: 365-day license
- `custom`: Custom duration (requires `customDays`)

**Response:**
```json
{
  "success": true,
  "license": {
    "id": "uuid",
    "licenseKey": "M123ABC-D456EFG-7K9M2P-2025",
    "licenseType": "yearly",
    "status": "active",
    "expiresAt": "2026-07-11T00:00:00Z"
  },
  "licenseCode": "M123ABC-D456EFG-7K9M2P-2025"
}
```

### Get All Licenses

```
GET /api/superadmin/licenses?page=1&limit=20&status=active&merchantId=uuid
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (active, expired, suspended)
- `merchantId` (optional): Filter by merchant

### Get License Details

```
GET /api/superadmin/licenses/:licenseId
Authorization: Bearer <token>
```

### Revoke License

```
POST /api/superadmin/licenses/:licenseId/revoke
Authorization: Bearer <token>
```

### Extend License

```
POST /api/superadmin/licenses/:licenseId/extend
Authorization: Bearer <token>
Content-Type: application/json

{
  "additionalDays": 30
}
```

### Get License Statistics

```
GET /api/superadmin/licenses/statistics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total": 150,
    "active": 120,
    "expired": 20,
    "suspended": 10,
    "expiringIn30Days": 15,
    "trial": 30,
    "yearly": 120
  }
}
```

### Get Licenses Expiring Soon

```
GET /api/superadmin/licenses/expiring-soon?days=35
Authorization: Bearer <token>
```

**Query Parameters:**
- `days` (optional): Threshold in days (default: 35)

**Response:**
```json
{
  "success": true,
  "licenses": [
    {
      "license": {
        "id": "uuid",
        "licenseKey": "M123ABC-D456EFG-7K9M2P-2025",
        "expiresAt": "2025-08-15T00:00:00Z"
      },
      "daysRemaining": 35
    }
  ],
  "threshold": "35 days"
}
```

---

## Analytics

### Platform Overview

```
GET /api/superadmin/analytics/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "overview": {
    "merchants": {
      "total": 250,
      "active": 200,
      "trial": 30,
      "suspended": 20
    },
    "licenses": {
      "total": 500,
      "active": 450,
      "expired": 50
    },
    "devices": {
      "total": 600,
      "active": 550
    },
    "orders": {
      "total": 5000,
      "totalRevenue": 500000.00,
      "averageOrderValue": 100.00
    }
  }
}
```

### Revenue Analytics

```
GET /api/superadmin/analytics/revenue?startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-12-31T23:59:59Z"
    },
    "summary": {
      "totalRevenue": 500000.00,
      "totalTax": 50000.00,
      "totalDiscount": 5000.00,
      "orderCount": 5000,
      "averageOrderValue": 100.00
    },
    "breakdown": {
      "byPaymentMethod": {
        "card": 300000.00,
        "cash": 150000.00,
        "terminal": 50000.00
      },
      "byOrderType": {
        "pos": 450000.00,
        "web_shop": 50000.00
      }
    }
  }
}
```

### Top Merchants by Revenue

```
GET /api/superadmin/analytics/top-merchants?limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of merchants to return (default: 10)

**Response:**
```json
{
  "success": true,
  "merchants": [
    {
      "merchant": {
        "id": "uuid",
        "name": "Top Business",
        "email": "top@example.com"
      },
      "revenue": 50000.00,
      "orderCount": 500
    }
  ]
}
```

### Subscription Distribution

```
GET /api/superadmin/analytics/subscription-distribution
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "distribution": {
    "total": 250,
    "distribution": {
      "free": 50,
      "starter": 100,
      "professional": 75,
      "enterprise": 25
    },
    "percentages": {
      "free": "20.00",
      "starter": "40.00",
      "professional": "30.00",
      "enterprise": "10.00"
    }
  }
}
```

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Rate Limiting

Currently no rate limiting is implemented. Production deployment should include:
- Per-IP rate limiting
- Per-user rate limiting
- Endpoint-specific limits

---

## Pagination

List endpoints support pagination via query parameters:

```
GET /api/superadmin/merchants?page=2&limit=50
```

**Parameters:**
- `page`: Page number (1-indexed, default: 1)
- `limit`: Items per page (default: 20, max: 100)

---

## Sorting & Filtering

Most list endpoints support filtering:

```
GET /api/superadmin/licenses?status=active&merchantId=uuid
```

---

## Webhooks (Future)

Planned webhook events:
- `merchant.created`
- `merchant.suspended`
- `license.expiring`
- `license.expired`
- `payment.received`

---

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get all merchants
const merchants = await api.get('/superadmin/merchants?limit=50');

// Create merchant
const newMerchant = await api.post('/superadmin/merchants', {
  email: 'new@example.com',
  password: 'password',
  businessName: 'New Business'
});

// Generate license
const license = await api.post('/superadmin/licenses/generate', {
  merchantId: 'uuid',
  deviceId: 'uuid',
  licenseType: 'yearly'
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

# Get platform overview
response = requests.get(
    'http://localhost:3000/api/superadmin/analytics/overview',
    headers=headers
)
overview = response.json()

# Get top merchants
response = requests.get(
    'http://localhost:3000/api/superadmin/analytics/top-merchants?limit=10',
    headers=headers
)
merchants = response.json()
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-11
