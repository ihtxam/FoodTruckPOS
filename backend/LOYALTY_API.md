# Loyalty Program API Documentation

Complete API reference for RFID loyalty cards, gift cards, and loyalty points management.

## Authentication

All loyalty endpoints require JWT token in Authorization header:

```
Authorization: Bearer <merchant_token>
```

---

## Loyalty Card Management

### Create Loyalty Card

```
POST /api/loyalty/cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardType": "loyalty",
  "customerId": "uuid",
  "initialBalance": 0
}
```

**Card Types:**
- `loyalty`: Loyalty points card (no balance)
- `gift_card`: Gift card with monetary balance

**Response:**
```json
{
  "success": true,
  "message": "Loyalty card created successfully",
  "card": {
    "id": "uuid",
    "cardNumber": "A1B2C3D4E5F6G7H8",
    "rfidCode": "RFID-A1B2C3D4E5F6G7H8",
    "cardType": "loyalty",
    "balance": "0",
    "pointsBalance": "0",
    "status": "active",
    "issuedAt": "2025-07-11T10:00:00Z",
    "expiresAt": null
  }
}
```

### Get All Loyalty Cards

```
GET /api/loyalty/cards?page=1&limit=20&cardType=loyalty&status=active
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `cardType` (optional): Filter by type (loyalty, gift_card)
- `status` (optional): Filter by status (active, suspended, expired)

**Response:**
```json
{
  "success": true,
  "cards": [
    {
      "id": "uuid",
      "cardNumber": "A1B2C3D4E5F6G7H8",
      "rfidCode": "RFID-A1B2C3D4E5F6G7H8",
      "cardType": "loyalty",
      "balance": "50.00",
      "pointsBalance": "250",
      "status": "active",
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "issuedAt": "2025-07-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Get Card by RFID Code

```
GET /api/loyalty/cards/rfid/RFID-A1B2C3D4E5F6G7H8
Authorization: Bearer <token>
```

Used for quick card lookup when scanning RFID tag.

**Response:**
```json
{
  "success": true,
  "card": {
    "id": "uuid",
    "cardNumber": "A1B2C3D4E5F6G7H8",
    "rfidCode": "RFID-A1B2C3D4E5F6G7H8",
    "cardType": "gift_card",
    "balance": "100.00",
    "pointsBalance": "0",
    "status": "active",
    "expiresAt": "2026-07-11T00:00:00Z"
  }
}
```

### Get Card by Card Number

```
GET /api/loyalty/cards/number/A1B2C3D4E5F6G7H8
Authorization: Bearer <token>
```

Alternative lookup method using card number.

---

## Balance Management

### Add Balance to Card

```
POST /api/loyalty/cards/:cardId/add-balance
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00
}
```

Used for:
- Recharging gift cards
- Adding credit to loyalty cards

**Response:**
```json
{
  "success": true,
  "message": "Added 50.00 to card balance",
  "card": {
    "id": "uuid",
    "balance": "150.00",
    "updatedAt": "2025-07-11T10:30:00Z"
  }
}
```

### Redeem Balance from Card

```
POST /api/loyalty/cards/:cardId/redeem
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 25.00,
  "orderId": "uuid"
}
```

Used for:
- Processing gift card payments
- Redeeming loyalty card balance

**Response:**
```json
{
  "success": true,
  "message": "Redeemed 25.00 from card",
  "card": {
    "id": "uuid",
    "balance": "125.00",
    "updatedAt": "2025-07-11T10:35:00Z"
  }
}
```

---

## Loyalty Points Management

### Add Loyalty Points

```
POST /api/loyalty/cards/:cardId/add-points
Authorization: Bearer <token>
Content-Type: application/json

{
  "points": 100
}
```

Award points for:
- Purchases (e.g., 1 point per dollar)
- Referrals
- Reviews
- Special promotions

**Response:**
```json
{
  "success": true,
  "message": "Added 100 loyalty points",
  "card": {
    "id": "uuid",
    "pointsBalance": "350",
    "updatedAt": "2025-07-11T10:40:00Z"
  }
}
```

### Redeem Loyalty Points

```
POST /api/loyalty/cards/:cardId/redeem-points
Authorization: Bearer <token>
Content-Type: application/json

{
  "points": 100,
  "orderId": "uuid"
}
```

Redeem points for:
- Discounts
- Free items
- Special rewards

**Response:**
```json
{
  "success": true,
  "message": "Redeemed 100 loyalty points",
  "card": {
    "id": "uuid",
    "pointsBalance": "250",
    "updatedAt": "2025-07-11T10:45:00Z"
  }
}
```

---

## Transaction History

### Get Card Transactions

```
GET /api/loyalty/cards/:cardId/transactions?page=1&limit=20
Authorization: Bearer <token>
```

View complete transaction history for a card.

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "transactionType": "redeem",
      "amount": "25.00",
      "balanceBefore": "150.00",
      "balanceAfter": "125.00",
      "description": "Redeemed 25.00 from card",
      "createdAt": "2025-07-11T10:35:00Z"
    },
    {
      "id": "uuid",
      "transactionType": "add_balance",
      "amount": "50.00",
      "balanceBefore": "100.00",
      "balanceAfter": "150.00",
      "description": "Added 50.00 to card balance",
      "createdAt": "2025-07-11T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

**Transaction Types:**
- `add_balance`: Balance added to card
- `redeem`: Balance redeemed from card
- `add_points`: Loyalty points added
- `redeem_points`: Loyalty points redeemed

---

## Card Management

### Suspend Card

```
POST /api/loyalty/cards/:cardId/suspend
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Lost card"
}
```

Suspend card for:
- Lost/stolen cards
- Fraudulent activity
- Account issues

**Response:**
```json
{
  "success": true,
  "message": "Card suspended successfully",
  "card": {
    "id": "uuid",
    "status": "suspended",
    "suspendedReason": "Lost card"
  }
}
```

### Reactivate Card

```
POST /api/loyalty/cards/:cardId/reactivate
Authorization: Bearer <token>
```

Reactivate a previously suspended card.

**Response:**
```json
{
  "success": true,
  "message": "Card reactivated successfully",
  "card": {
    "id": "uuid",
    "status": "active",
    "suspendedReason": null
  }
}
```

---

## Analytics & Reporting

### Get Loyalty Statistics

```
GET /api/loyalty/statistics
Authorization: Bearer <token>
```

Get overview of loyalty program.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalCards": 500,
    "activeCards": 450,
    "giftCards": 200,
    "loyaltyCards": 300,
    "totalBalance": 10000.00,
    "totalPoints": 50000,
    "averageBalance": 20.00
  }
}
```

### Get Expiring Gift Cards

```
GET /api/loyalty/expiring-gift-cards?days=30
Authorization: Bearer <token>
```

Get gift cards expiring within threshold.

**Query Parameters:**
- `days` (optional): Threshold in days (default: 30)

**Response:**
```json
{
  "success": true,
  "cards": [
    {
      "id": "uuid",
      "cardNumber": "A1B2C3D4E5F6G7H8",
      "balance": "50.00",
      "expiresAt": "2025-08-10T00:00:00Z"
    }
  ],
  "threshold": "30 days"
}
```

### Get Loyalty Analytics

```
GET /api/loyalty/analytics?startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <token>
```

Get detailed loyalty program analytics.

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "totalTransactions": 1500,
    "totalAdded": 15000.00,
    "totalRedeemed": 8000.00,
    "netValue": 7000.00,
    "byType": {
      "add_balance": 500,
      "redeem": 400,
      "add_points": 400,
      "redeem_points": 200
    }
  }
}
```

---

## RFID Integration

### How RFID Works

1. **Card Creation**: System generates unique RFID code (16-digit hex)
2. **Card Encoding**: RFID code written to physical card/tag
3. **Scanning**: Customer taps card on RFID reader
4. **Lookup**: POS system queries card by RFID code
5. **Transaction**: Balance/points updated in real-time

### RFID Code Format

```
RFID-A1B2C3D4E5F6G7H8
```

- Prefix: `RFID-`
- Code: 16-character hexadecimal string
- Unique per card
- Encoded on physical RFID tag

### POS Integration Example

```javascript
// When customer taps RFID card
const rfidCode = "RFID-A1B2C3D4E5F6G7H8";

// Look up card
const response = await fetch(
  `http://localhost:3000/api/loyalty/cards/rfid/${rfidCode}`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { card } = await response.json();

// Display card info
console.log(`Balance: ${card.balance}`);
console.log(`Points: ${card.pointsBalance}`);

// Process transaction
if (card.status === 'active') {
  // Redeem balance or points
  await fetch(
    `http://localhost:3000/api/loyalty/cards/${card.id}/redeem`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 25.00, orderId: 'order-123' })
    }
  );
}
```

---

## Gift Card Operations

### Create Gift Card

```
POST /api/loyalty/cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardType": "gift_card",
  "initialBalance": 100.00
}
```

Create gift card with initial balance.

### Sell Gift Card

1. Create gift card with desired balance
2. Print card with card number or RFID code
3. Customer pays for card
4. Record payment in order system

### Recharge Gift Card

```
POST /api/loyalty/cards/:cardId/add-balance
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00
}
```

Add balance to existing gift card.

### Check Balance

```
GET /api/loyalty/cards/rfid/RFID-A1B2C3D4E5F6G7H8
Authorization: Bearer <token>
```

Customer can check balance by scanning card.

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common Errors:**
- `Card not found`: RFID code or card number doesn't exist
- `Insufficient balance`: Not enough balance to redeem
- `Insufficient points`: Not enough points to redeem
- `Card suspended`: Card is suspended and cannot be used
- `Card expired`: Gift card has expired

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

// Create loyalty card
const card = await api.post('/loyalty/cards', {
  cardType: 'loyalty',
  customerId: 'uuid'
});

// Look up by RFID
const scannedCard = await api.get('/loyalty/cards/rfid/RFID-A1B2C3D4E5F6G7H8');

// Add points
await api.post(`/loyalty/cards/${card.data.card.id}/add-points`, {
  points: 100
});

// Redeem balance
await api.post(`/loyalty/cards/${card.data.card.id}/redeem`, {
  amount: 25.00,
  orderId: 'order-123'
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

# Get loyalty statistics
response = requests.get(
    'http://localhost:3000/api/loyalty/statistics',
    headers=headers
)
stats = response.json()

# Get expiring gift cards
response = requests.get(
    'http://localhost:3000/api/loyalty/expiring-gift-cards?days=30',
    headers=headers
)
expiring = response.json()
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-11
