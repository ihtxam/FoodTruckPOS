# Payment & Web Shop API Documentation

Complete API reference for payment processing and web shop functionality.

---

## Payment API

### Authentication

All payment endpoints require JWT token in Authorization header:

```
Authorization: Bearer <merchant_token>
```

### Initialize Payment Session

```
POST /api/payment/initialize
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "uuid",
  "amount": 150.00,
  "currency": "USD",
  "returnUrl": "https://example.com/payment/return"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_id",
    "clientKey": "client_key",
    "sessionData": "encrypted_session_data"
  }
}
```

### Process Card Payment

```
POST /api/payment/card
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "uuid",
  "amount": 150.00,
  "currency": "USD",
  "paymentMethod": {
    "type": "scheme",
    "number": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2025",
    "cvc": "737",
    "holderName": "John Doe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "resultCode": "Authorised",
    "pspReference": "8814123456789012",
    "amount": {
      "value": 15000,
      "currency": "USD"
    }
  }
}
```

**Result Codes:**
- `Authorised`: Payment successful
- `Refused`: Payment declined
- `Pending`: Payment pending (3D Secure, etc.)
- `Error`: Payment error

### Process Terminal Payment

```
POST /api/payment/terminal
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "uuid",
  "amount": 150.00,
  "currency": "USD",
  "terminalId": "terminal_123"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "resultCode": "Authorised",
    "pspReference": "8814123456789012"
  }
}
```

### Refund Payment

```
POST /api/payment/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "uuid",
  "amount": 50.00
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "reference": "refund_reference",
    "status": "received"
  }
}
```

### Get Payment Methods

```
GET /api/payment/methods
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "methods": [
    {
      "type": "card",
      "name": "Credit/Debit Card",
      "enabled": true
    },
    {
      "type": "terminal",
      "name": "Payment Terminal",
      "enabled": true
    },
    {
      "type": "cash",
      "name": "Cash",
      "enabled": true
    }
  ]
}
```

### Get Transaction History

```
GET /api/payment/transactions?page=1&limit=20&status=completed
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (pending, completed, failed)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "amount": "150.00",
      "paymentMethod": "card",
      "status": "completed",
      "adyenReference": "8814123456789012",
      "processedAt": "2025-07-11T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Get Payment Summary

```
GET /api/payment/summary?startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalAmount": 5000.00,
    "transactionCount": 50,
    "byStatus": {
      "completed": 4500.00,
      "failed": 500.00
    },
    "byMethod": {
      "card": 3000.00,
      "terminal": 1500.00,
      "cash": 500.00
    }
  }
}
```

---

## Web Shop API

### Public Endpoints (No Authentication Required)

#### Get Shop Info

```
GET /api/webshop/:merchantId/info
```

**Response:**
```json
{
  "success": true,
  "info": {
    "id": "uuid",
    "name": "Business Name",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "phone": "+1234567890",
    "email": "merchant@example.com"
  }
}
```

#### Get Public Products

```
GET /api/webshop/:merchantId/products?page=1&limit=20&categoryId=uuid&search=query
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `categoryId` (optional): Filter by category
- `search` (optional): Search by name or description

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "name": "Product Name",
      "price": "29.99",
      "description": "Product description",
      "imageUrl": "https://example.com/image.jpg",
      "stock": 100,
      "category": {
        "id": "uuid",
        "name": "Category Name"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

#### Get Public Categories

```
GET /api/webshop/:merchantId/categories
```

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": "uuid",
      "name": "Electronics",
      "color": "#FF5733"
    }
  ]
}
```

#### Create Web Shop Order

```
POST /api/webshop/:merchantId/orders
Content-Type: application/json

{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ],
  "customerEmail": "customer@example.com",
  "customerPhone": "+1234567890",
  "customerName": "John Doe",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "notes": "Please deliver after 5 PM"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "id": "uuid",
    "orderNumber": "WEB-1720000000-ABC123",
    "status": "pending",
    "subtotal": "59.98",
    "taxAmount": "5.99",
    "total": "65.97",
    "paymentStatus": "pending"
  }
}
```

### Protected Endpoints (Merchant Authentication Required)

#### Get Web Shop Orders

```
GET /api/webshop/merchant/orders?page=1&limit=20&status=pending
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (pending, processing, shipped, delivered)

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "WEB-1720000000-ABC123",
      "status": "pending",
      "shippingStatus": "pending",
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "items": [
        {
          "product": {
            "name": "Product Name"
          },
          "quantity": 2,
          "unitPrice": "29.99"
        }
      ],
      "total": "65.97",
      "createdAt": "2025-07-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

#### Update Shipping Status

```
PUT /api/webshop/merchant/orders/:orderId/shipping
Authorization: Bearer <token>
Content-Type: application/json

{
  "shippingStatus": "shipped"
}
```

**Shipping Status Options:**
- `pending`: Order received
- `processing`: Order being prepared
- `shipped`: Order shipped
- `delivered`: Order delivered

**Response:**
```json
{
  "success": true,
  "message": "Shipping status updated",
  "order": {
    "id": "uuid",
    "shippingStatus": "shipped"
  }
}
```

#### Get Web Shop Analytics

```
GET /api/webshop/merchant/analytics?startDate=2025-01-01&endDate=2025-12-31
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
    "totalOrders": 150,
    "completedOrders": 120,
    "totalRevenue": 15000.00,
    "averageOrderValue": 100.00,
    "byStatus": {
      "pending": 10,
      "processing": 5,
      "shipped": 15,
      "delivered": 120
    }
  }
}
```

#### Sync Order to POS

```
POST /api/webshop/merchant/orders/:orderId/sync
Authorization: Bearer <token>
```

Synchronizes a web shop order to the POS system for fulfillment.

**Response:**
```json
{
  "success": true,
  "message": "Order synced to POS",
  "order": {
    "id": "uuid",
    "syncedToPOS": true
  }
}
```

---

## Adyen Integration Setup

### Environment Variables Required

```env
ADYEN_API_BASE=https://checkout-test.adyen.com/v71
ADYEN_API_KEY=your_adyen_api_key
ADYEN_MERCHANT_ACCOUNT=your_merchant_account
APP_URL=https://your-app.com
```

### Supported Payment Methods

1. **Card Payments**
   - Visa, Mastercard, American Express
   - 3D Secure support
   - Recurring payments

2. **Terminal Payments**
   - Adyen payment terminals
   - PIN-based transactions
   - Receipt printing

3. **Cash**
   - Manual cash entry
   - Change calculation

### Payment Flow

```
1. Customer initiates checkout
   ↓
2. Initialize payment session (POST /api/payment/initialize)
   ↓
3. Customer enters payment details
   ↓
4. Process payment (POST /api/payment/card or /api/payment/terminal)
   ↓
5. Adyen returns result code
   ↓
6. Record transaction (automatic)
   ↓
7. Update order status
   ↓
8. Send confirmation to customer
```

### Webhook Handling (Future)

Adyen sends webhooks for:
- Payment authorisation
- Payment capture
- Refunds
- Chargebacks
- Disputes

---

## Error Handling

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

### Common Payment Errors

- `Refused`: Card declined by issuer
- `Expired`: Card expired
- `Fraud`: Potential fraud detected
- `3D Secure Failed`: 3D Secure authentication failed
- `Insufficient Funds`: Customer has insufficient funds

---

## SDK Examples

### JavaScript/Node.js - Payment Processing

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Process card payment
async function processPayment(orderId, amount, cardDetails) {
  try {
    const response = await api.post('/payment/card', {
      orderId,
      amount,
      paymentMethod: cardDetails
    });
    
    if (response.data.result.resultCode === 'Authorised') {
      console.log('Payment successful:', response.data.result);
    } else {
      console.log('Payment declined:', response.data.result);
    }
  } catch (error) {
    console.error('Payment error:', error.response.data);
  }
}
```

### JavaScript/Node.js - Web Shop

```javascript
// Get products
const products = await axios.get(
  'http://localhost:3000/api/webshop/merchant-id/products'
);

// Create order
const order = await axios.post(
  'http://localhost:3000/api/webshop/merchant-id/orders',
  {
    items: [
      { productId: 'uuid', quantity: 2 }
    ],
    customerEmail: 'customer@example.com',
    customerName: 'John Doe'
  }
);

console.log('Order created:', order.data.order);
```

### Python - Payment Processing

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

# Get payment methods
response = requests.get(
    'http://localhost:3000/api/payment/methods',
    headers=headers
)
methods = response.json()

# Get transaction history
response = requests.get(
    'http://localhost:3000/api/payment/transactions?limit=50',
    headers=headers
)
transactions = response.json()
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-11
